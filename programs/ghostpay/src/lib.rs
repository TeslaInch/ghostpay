use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
};
use encrypt_anchor::EncryptContext;
use encrypt_dsl::prelude::encrypt_fn;
use encrypt_types::encrypted::EUint64;

declare_id!("AgHtDZL7Sr8KPhAxxBxwgxrgU3SxrLPrfRhLGYDZaCix");

pub const MAX_VAULT_NAME_LEN: usize = 32;
const ENCRYPT_CPI_AUTHORITY_SEED: &[u8] = b"__encrypt_cpi_authority";
const IX_REQUEST_DECRYPTION: u8 = 11;

/// Hand-rolled `request_decryption` CPI.
///
/// The upstream `encrypt-anchor` helper marks `request_acct` as `is_signer=false`
/// in the CPI account meta, which prevents the Encrypt program from creating
/// the request account on-chain (the inner `system_program::create_account`
/// call would attempt to escalate `request_acct`'s signer flag and the runtime
/// rejects). This local copy passes `request_acct` through with the signer
/// flag preserved so the inner create_account succeeds.
fn request_decryption_with_signer<'info>(
    ctx: &EncryptContext<'info>,
    request_acct: &AccountInfo<'info>,
    ciphertext: &AccountInfo<'info>,
) -> Result<[u8; 32]> {
    let ct_data = ciphertext.try_borrow_data()?;
    let digest = *encrypt_anchor::accounts::ciphertext_digest(&ct_data)
        .map_err(|_| error!(GhostPayError::CiphertextMismatch))?;
    drop(ct_data);

    let ix_data = vec![IX_REQUEST_DECRYPTION];
    let accounts = vec![
        AccountMeta::new_readonly(ctx.config.key(), false),
        AccountMeta::new(ctx.deposit.key(), false),
        AccountMeta::new(request_acct.key(), true),
        AccountMeta::new_readonly(ctx.caller_program.key(), false),
        AccountMeta::new_readonly(ctx.cpi_authority.key(), true),
        AccountMeta::new_readonly(ciphertext.key(), false),
        AccountMeta::new(ctx.payer.key(), true),
        AccountMeta::new_readonly(ctx.system_program.key(), false),
        AccountMeta::new_readonly(ctx.event_authority.key(), false),
        AccountMeta::new_readonly(ctx.encrypt_program.key(), false),
    ];

    let ix = Instruction {
        program_id: ctx.encrypt_program.key(),
        accounts,
        data: ix_data,
    };

    let account_infos = [
        ctx.config.clone(),
        ctx.deposit.clone(),
        request_acct.clone(),
        ctx.caller_program.clone(),
        ctx.cpi_authority.clone(),
        ciphertext.clone(),
        ctx.payer.clone(),
        ctx.system_program.clone(),
        ctx.event_authority.clone(),
        ctx.encrypt_program.clone(),
    ];

    let seeds = &[ENCRYPT_CPI_AUTHORITY_SEED, &[ctx.cpi_authority_bump]];
    let signer_seeds = &[&seeds[..]];
    invoke_signed(&ix, &account_infos, signer_seeds)?;
    Ok(digest)
}

// ── FHE Computation Graphs ──
//
// Each `#[encrypt_fn]` expands into:
//   • `fn <name>() -> Vec<u8>` — the serialized graph the executor evaluates
//   • a method `<name>` on every `EncryptCpi` impl, which the Anchor
//     instructions below invoke as
//     `ctx.<name>(input_cts.., output_cts..)`.

/// Sum three contributor salaries into a single encrypted total burn.
#[encrypt_fn]
fn compute_total_burn(s1: EUint64, s2: EUint64, s3: EUint64) -> EUint64 {
    s1 + s2 + s3
}

/// Branchless verify-and-deduct: returns `(new_vault_balance, payment_amount)`.
/// If the vault has insufficient funds the balance stays put and the payment
/// is zero — the contract never reveals which branch was taken.
#[encrypt_fn]
fn verify_and_deduct(vault: EUint64, salary: EUint64) -> (EUint64, EUint64) {
    let has_funds = vault >= salary;
    let new_vault = if has_funds { vault - salary } else { vault };
    let payment = if has_funds { salary } else { EUint64::from(0u64) };
    (new_vault, payment)
}

/// Returns 1 if `salary >= median`, else 0, as an encrypted `EUint64`.
#[encrypt_fn]
fn compare_to_benchmark(salary: EUint64, median: EUint64) -> EUint64 {
    if salary >= median {
        EUint64::from(1u64)
    } else {
        EUint64::from(0u64)
    }
}

#[program]
pub mod ghostpay {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>, vault_name: String) -> Result<()> {
        require!(
            vault_name.len() <= MAX_VAULT_NAME_LEN,
            GhostPayError::NameTooLong
        );

        let vault = &mut ctx.accounts.vault;
        vault.admin = ctx.accounts.admin.key();
        vault.vault_name = vault_name;
        vault.contributor_count = 0;
        vault.balance_ct = [0u8; 32];
        vault.created_at = Clock::get()?.unix_timestamp;
        vault.bump = ctx.bumps.vault;

        Ok(())
    }

    /// Bind a pre-created encrypted treasury balance ciphertext to the vault.
    /// The ciphertext must already be authorized to this program.
    pub fn set_vault_balance(ctx: Context<SetVaultBalance>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.balance_ct = ctx.accounts.balance_ct.key().to_bytes();
        Ok(())
    }

    pub fn register_contributor(
        ctx: Context<RegisterContributor>,
        wallet: Pubkey,
        sol_pct: u8,
        usdc_pct: u8,
        fiat_pct: u8,
    ) -> Result<()> {
        require_eq!(
            sol_pct as u16 + usdc_pct as u16 + fiat_pct as u16,
            100u16,
            GhostPayError::PercentagesMustSumTo100
        );

        let contributor = &mut ctx.accounts.contributor;
        contributor.wallet = wallet;
        contributor.vault = ctx.accounts.vault.key();
        contributor.sol_percentage = sol_pct;
        contributor.usdc_percentage = usdc_pct;
        contributor.fiat_percentage = fiat_pct;
        contributor.is_active = true;
        contributor.salary_ct = [0u8; 32];
        contributor.pending_decrypt_digest = [0u8; 32];
        contributor.registered_at = Clock::get()?.unix_timestamp;
        contributor.bump = ctx.bumps.contributor;

        let vault = &mut ctx.accounts.vault;
        vault.contributor_count = vault
            .contributor_count
            .checked_add(1)
            .ok_or(GhostPayError::Overflow)?;

        Ok(())
    }

    /// Bind a pre-created encrypted salary ciphertext to a contributor.
    /// Admin only. The ciphertext must already be authorized to this program.
    pub fn set_salary(ctx: Context<SetSalary>) -> Result<()> {
        let contributor = &mut ctx.accounts.contributor;
        contributor.salary_ct = ctx.accounts.salary_ct.key().to_bytes();
        Ok(())
    }

    pub fn update_preferences(
        ctx: Context<UpdatePreferences>,
        sol_pct: u8,
        usdc_pct: u8,
        fiat_pct: u8,
    ) -> Result<()> {
        require_eq!(
            sol_pct as u16 + usdc_pct as u16 + fiat_pct as u16,
            100u16,
            GhostPayError::PercentagesMustSumTo100
        );

        let contributor = &mut ctx.accounts.contributor;
        contributor.sol_percentage = sol_pct;
        contributor.usdc_percentage = usdc_pct;
        contributor.fiat_percentage = fiat_pct;

        Ok(())
    }

    pub fn close_contributor(ctx: Context<CloseContributor>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.contributor_count = vault
            .contributor_count
            .checked_sub(1)
            .ok_or(GhostPayError::Underflow)?;
        Ok(())
    }

    /// Homomorphically sum three contributors' salaries into a fresh
    /// encrypted total-burn ciphertext, and mint a `PayrollBatch` record.
    pub fn compute_payroll_burn(
        ctx: Context<ComputePayrollBurn>,
        batch_id: u64,
        cpi_authority_bump: u8,
    ) -> Result<()> {
        require!(
            ctx.accounts.payer.key() == ctx.accounts.vault.admin,
            GhostPayError::Unauthorized
        );
        require!(
            ctx.accounts.salary_a_ct.key().to_bytes() == ctx.accounts.contributor_a.salary_ct,
            GhostPayError::CiphertextMismatch
        );
        require!(
            ctx.accounts.salary_b_ct.key().to_bytes() == ctx.accounts.contributor_b.salary_ct,
            GhostPayError::CiphertextMismatch
        );
        require!(
            ctx.accounts.salary_c_ct.key().to_bytes() == ctx.accounts.contributor_c.salary_ct,
            GhostPayError::CiphertextMismatch
        );

        let encrypt_ctx = EncryptContext {
            encrypt_program: ctx.accounts.encrypt_program.to_account_info(),
            config: ctx.accounts.config.to_account_info(),
            deposit: ctx.accounts.deposit.to_account_info(),
            cpi_authority: ctx.accounts.cpi_authority.to_account_info(),
            caller_program: ctx.accounts.caller_program.to_account_info(),
            network_encryption_key: ctx.accounts.network_encryption_key.to_account_info(),
            payer: ctx.accounts.payer.to_account_info(),
            event_authority: ctx.accounts.event_authority.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            cpi_authority_bump,
        };

        encrypt_ctx.compute_total_burn(
            ctx.accounts.salary_a_ct.to_account_info(),
            ctx.accounts.salary_b_ct.to_account_info(),
            ctx.accounts.salary_c_ct.to_account_info(),
            ctx.accounts.burn_total_ct.to_account_info(),
        )?;

        let batch = &mut ctx.accounts.batch;
        batch.vault = ctx.accounts.vault.key();
        batch.batch_id = batch_id;
        batch.executed_at = Clock::get()?.unix_timestamp;
        batch.contributor_count = 3;
        batch.burn_total_ct = ctx.accounts.burn_total_ct.key().to_bytes();
        batch.pending_decrypt_digest = [0u8; 32];
        batch.status = PayrollStatus::Pending;
        batch.bump = ctx.bumps.batch;

        Ok(())
    }

    /// Homomorphically verify the vault has enough balance to pay one
    /// contributor's salary, deduct it, and emit a fresh `payment_ct`. The
    /// vault's balance ciphertext is updated in place — output overwrites
    /// input — so subsequent calls observe the deducted balance.
    pub fn run_payroll(ctx: Context<RunPayroll>, cpi_authority_bump: u8) -> Result<()> {
        require!(
            ctx.accounts.payer.key() == ctx.accounts.vault.admin,
            GhostPayError::Unauthorized
        );
        require!(
            ctx.accounts.vault_balance_ct.key().to_bytes() == ctx.accounts.vault.balance_ct,
            GhostPayError::CiphertextMismatch
        );
        require!(
            ctx.accounts.salary_ct.key().to_bytes() == ctx.accounts.contributor.salary_ct,
            GhostPayError::CiphertextMismatch
        );

        let encrypt_ctx = EncryptContext {
            encrypt_program: ctx.accounts.encrypt_program.to_account_info(),
            config: ctx.accounts.config.to_account_info(),
            deposit: ctx.accounts.deposit.to_account_info(),
            cpi_authority: ctx.accounts.cpi_authority.to_account_info(),
            caller_program: ctx.accounts.caller_program.to_account_info(),
            network_encryption_key: ctx.accounts.network_encryption_key.to_account_info(),
            payer: ctx.accounts.payer.to_account_info(),
            event_authority: ctx.accounts.event_authority.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            cpi_authority_bump,
        };

        let vault_ct = ctx.accounts.vault_balance_ct.to_account_info();
        encrypt_ctx.verify_and_deduct(
            vault_ct.clone(),
            ctx.accounts.salary_ct.to_account_info(),
            vault_ct,
            ctx.accounts.payment_ct.to_account_info(),
        )?;

        Ok(())
    }

    /// Homomorphically compare a contributor's salary to a benchmark median.
    /// Result ciphertext encodes 1 if salary ≥ median, else 0.
    pub fn benchmark_salary(
        ctx: Context<BenchmarkSalary>,
        cpi_authority_bump: u8,
    ) -> Result<()> {
        require!(
            ctx.accounts.salary_ct.key().to_bytes() == ctx.accounts.contributor.salary_ct,
            GhostPayError::CiphertextMismatch
        );

        let encrypt_ctx = EncryptContext {
            encrypt_program: ctx.accounts.encrypt_program.to_account_info(),
            config: ctx.accounts.config.to_account_info(),
            deposit: ctx.accounts.deposit.to_account_info(),
            cpi_authority: ctx.accounts.cpi_authority.to_account_info(),
            caller_program: ctx.accounts.caller_program.to_account_info(),
            network_encryption_key: ctx.accounts.network_encryption_key.to_account_info(),
            payer: ctx.accounts.payer.to_account_info(),
            event_authority: ctx.accounts.event_authority.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            cpi_authority_bump,
        };

        encrypt_ctx.compare_to_benchmark(
            ctx.accounts.salary_ct.to_account_info(),
            ctx.accounts.median_ct.to_account_info(),
            ctx.accounts.result_ct.to_account_info(),
        )?;

        Ok(())
    }

    /// Admin-initiated decryption request for a `PayrollBatch`'s
    /// homomorphic burn total. Stores the digest on the batch for later
    /// reveal verification.
    pub fn request_burn_decrypt(
        ctx: Context<RequestBurnDecrypt>,
        cpi_authority_bump: u8,
    ) -> Result<()> {
        require!(
            ctx.accounts.payer.key() == ctx.accounts.vault.admin,
            GhostPayError::Unauthorized
        );
        require!(
            ctx.accounts.burn_total_ct.key().to_bytes() == ctx.accounts.batch.burn_total_ct,
            GhostPayError::CiphertextMismatch
        );

        let encrypt_ctx = EncryptContext {
            encrypt_program: ctx.accounts.encrypt_program.to_account_info(),
            config: ctx.accounts.config.to_account_info(),
            deposit: ctx.accounts.deposit.to_account_info(),
            cpi_authority: ctx.accounts.cpi_authority.to_account_info(),
            caller_program: ctx.accounts.caller_program.to_account_info(),
            network_encryption_key: ctx.accounts.network_encryption_key.to_account_info(),
            payer: ctx.accounts.payer.to_account_info(),
            event_authority: ctx.accounts.event_authority.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            cpi_authority_bump,
        };

        let digest = request_decryption_with_signer(
            &encrypt_ctx,
            &ctx.accounts.request_acct.to_account_info(),
            &ctx.accounts.burn_total_ct.to_account_info(),
        )?;

        let batch = &mut ctx.accounts.batch;
        batch.pending_decrypt_digest = digest;

        Ok(())
    }

    /// Reveal a previously-requested burn-total decryption. Verifies the
    /// response against `batch.pending_decrypt_digest`, emits it as a
    /// `BurnTotalRevealed` event, and clears the digest. Cleartext is
    /// **never** stored on-chain.
    pub fn reveal_burn_total(ctx: Context<RevealBurnTotal>) -> Result<()> {
        require!(
            ctx.accounts.payer.key() == ctx.accounts.vault.admin,
            GhostPayError::Unauthorized
        );

        let batch = &ctx.accounts.batch;
        let req_data = ctx.accounts.request_acct.try_borrow_data()?;

        use encrypt_types::encrypted::Uint64;
        let total = *encrypt_anchor::accounts::read_decrypted_verified::<Uint64>(
            &req_data,
            &batch.pending_decrypt_digest,
        )
        .map_err(|_| GhostPayError::DecryptionNotComplete)?;

        drop(req_data);

        emit!(BurnTotalRevealed {
            batch: batch.key(),
            vault: batch.vault,
            batch_id: batch.batch_id,
            total,
            revealed_at: Clock::get()?.unix_timestamp,
        });

        let batch = &mut ctx.accounts.batch;
        batch.pending_decrypt_digest = [0u8; 32];

        Ok(())
    }

    /// Reveal a previously-requested salary decryption. Verifies the
    /// decryptor network's response against the digest captured at request
    /// time, emits the cleartext as a `SalaryRevealed` event, and clears
    /// the stored digest so a stale request can't be replayed.
    ///
    /// The cleartext is **never** stored on-chain — it lives only in the
    /// transaction log, available off-chain via RPC.
    pub fn reveal_salary(ctx: Context<RevealSalary>) -> Result<()> {
        let contributor = &ctx.accounts.contributor;
        let req_data = ctx.accounts.request_acct.try_borrow_data()?;

        use encrypt_types::encrypted::Uint64;
        let salary = *encrypt_anchor::accounts::read_decrypted_verified::<Uint64>(
            &req_data,
            &contributor.pending_decrypt_digest,
        )
        .map_err(|_| GhostPayError::DecryptionNotComplete)?;

        drop(req_data);

        emit!(SalaryRevealed {
            contributor: contributor.key(),
            vault: contributor.vault,
            wallet: contributor.wallet,
            salary,
            revealed_at: Clock::get()?.unix_timestamp,
        });

        let contributor = &mut ctx.accounts.contributor;
        contributor.pending_decrypt_digest = [0u8; 32];

        Ok(())
    }

    /// Contributor-initiated request to decrypt their own salary via the
    /// Encrypt decryptor network. Stores the returned digest on the
    /// `ContributorRecord` so the reveal step can verify the response.
    pub fn request_salary_decrypt(
        ctx: Context<RequestSalaryDecrypt>,
        cpi_authority_bump: u8,
    ) -> Result<()> {
        require!(
            ctx.accounts.salary_ct.key().to_bytes() == ctx.accounts.contributor.salary_ct,
            GhostPayError::CiphertextMismatch
        );

        let encrypt_ctx = EncryptContext {
            encrypt_program: ctx.accounts.encrypt_program.to_account_info(),
            config: ctx.accounts.config.to_account_info(),
            deposit: ctx.accounts.deposit.to_account_info(),
            cpi_authority: ctx.accounts.cpi_authority.to_account_info(),
            caller_program: ctx.accounts.caller_program.to_account_info(),
            network_encryption_key: ctx.accounts.network_encryption_key.to_account_info(),
            payer: ctx.accounts.payer.to_account_info(),
            event_authority: ctx.accounts.event_authority.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            cpi_authority_bump,
        };

        let digest = request_decryption_with_signer(
            &encrypt_ctx,
            &ctx.accounts.request_acct.to_account_info(),
            &ctx.accounts.salary_ct.to_account_info(),
        )?;

        let contributor = &mut ctx.accounts.contributor;
        contributor.pending_decrypt_digest = digest;

        Ok(())
    }
}

// ── State ──

#[account]
#[derive(InitSpace)]
pub struct DaoVault {
    pub admin: Pubkey,
    #[max_len(MAX_VAULT_NAME_LEN)]
    pub vault_name: String,
    pub contributor_count: u64,
    pub balance_ct: [u8; 32],
    pub created_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ContributorRecord {
    pub wallet: Pubkey,
    pub vault: Pubkey,
    pub sol_percentage: u8,
    pub usdc_percentage: u8,
    pub fiat_percentage: u8,
    pub is_active: bool,
    pub salary_ct: [u8; 32],
    pub pending_decrypt_digest: [u8; 32],
    pub registered_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PayrollBatch {
    pub vault: Pubkey,
    pub batch_id: u64,
    pub executed_at: i64,
    pub contributor_count: u64,
    pub burn_total_ct: [u8; 32],
    pub pending_decrypt_digest: [u8; 32],
    pub status: PayrollStatus,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum PayrollStatus {
    Pending,
    Executed,
    Failed,
}

// ── Accounts ──

#[derive(Accounts)]
#[instruction(vault_name: String)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + DaoVault::INIT_SPACE,
        seeds = [b"vault", admin.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, DaoVault>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetVaultBalance<'info> {
    #[account(
        mut,
        seeds = [b"vault", admin.key().as_ref()],
        bump = vault.bump,
        has_one = admin @ GhostPayError::Unauthorized,
    )]
    pub vault: Account<'info, DaoVault>,
    pub admin: Signer<'info>,
    /// CHECK: encrypted vault-balance ciphertext; must already be authorized to this program.
    pub balance_ct: UncheckedAccount<'info>,
}

#[derive(Accounts)]
#[instruction(wallet: Pubkey)]
pub struct RegisterContributor<'info> {
    #[account(
        mut,
        seeds = [b"vault", admin.key().as_ref()],
        bump = vault.bump,
        has_one = admin @ GhostPayError::Unauthorized,
    )]
    pub vault: Account<'info, DaoVault>,
    #[account(
        init,
        payer = admin,
        space = 8 + ContributorRecord::INIT_SPACE,
        seeds = [b"contributor", vault.key().as_ref(), wallet.as_ref()],
        bump,
    )]
    pub contributor: Account<'info, ContributorRecord>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetSalary<'info> {
    #[account(
        seeds = [b"vault", admin.key().as_ref()],
        bump = vault.bump,
        has_one = admin @ GhostPayError::Unauthorized,
    )]
    pub vault: Account<'info, DaoVault>,
    #[account(
        mut,
        seeds = [b"contributor", vault.key().as_ref(), contributor.wallet.as_ref()],
        bump = contributor.bump,
        has_one = vault @ GhostPayError::Unauthorized,
    )]
    pub contributor: Account<'info, ContributorRecord>,
    pub admin: Signer<'info>,
    /// CHECK: encrypted salary ciphertext; must already be authorized to this program.
    pub salary_ct: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct UpdatePreferences<'info> {
    pub vault: Account<'info, DaoVault>,
    #[account(
        mut,
        seeds = [b"contributor", vault.key().as_ref(), wallet.key().as_ref()],
        bump = contributor.bump,
        has_one = wallet @ GhostPayError::Unauthorized,
        has_one = vault @ GhostPayError::Unauthorized,
    )]
    pub contributor: Account<'info, ContributorRecord>,
    pub wallet: Signer<'info>,
}

#[derive(Accounts)]
pub struct CloseContributor<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.admin.as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, DaoVault>,
    #[account(
        mut,
        close = wallet,
        seeds = [b"contributor", vault.key().as_ref(), wallet.key().as_ref()],
        bump = contributor.bump,
        has_one = wallet @ GhostPayError::Unauthorized,
        has_one = vault @ GhostPayError::Unauthorized,
    )]
    pub contributor: Account<'info, ContributorRecord>,
    #[account(mut)]
    pub wallet: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(batch_id: u64)]
pub struct ComputePayrollBurn<'info> {
    pub vault: Account<'info, DaoVault>,
    #[account(
        init,
        payer = payer,
        space = 8 + PayrollBatch::INIT_SPACE,
        seeds = [b"batch", vault.key().as_ref(), batch_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub batch: Account<'info, PayrollBatch>,
    #[account(has_one = vault @ GhostPayError::Unauthorized)]
    pub contributor_a: Account<'info, ContributorRecord>,
    #[account(has_one = vault @ GhostPayError::Unauthorized)]
    pub contributor_b: Account<'info, ContributorRecord>,
    #[account(has_one = vault @ GhostPayError::Unauthorized)]
    pub contributor_c: Account<'info, ContributorRecord>,
    /// CHECK: salary ciphertext for contributor_a; must equal contributor_a.salary_ct.
    #[account(mut)]
    pub salary_a_ct: UncheckedAccount<'info>,
    /// CHECK: salary ciphertext for contributor_b; must equal contributor_b.salary_ct.
    #[account(mut)]
    pub salary_b_ct: UncheckedAccount<'info>,
    /// CHECK: salary ciphertext for contributor_c; must equal contributor_c.salary_ct.
    #[account(mut)]
    pub salary_c_ct: UncheckedAccount<'info>,
    /// CHECK: fresh ciphertext that will hold the encrypted total burn.
    #[account(mut)]
    pub burn_total_ct: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: Encrypt program.
    pub encrypt_program: UncheckedAccount<'info>,
    /// CHECK: Encrypt config PDA.
    pub config: UncheckedAccount<'info>,
    /// CHECK: Encrypt deposit PDA.
    #[account(mut)]
    pub deposit: UncheckedAccount<'info>,
    /// CHECK: This program's CPI-authority PDA (seed `__encrypt_cpi_authority`).
    pub cpi_authority: UncheckedAccount<'info>,
    /// CHECK: This program's identity, used by Encrypt as the caller program.
    pub caller_program: UncheckedAccount<'info>,
    /// CHECK: Encrypt network encryption key account.
    pub network_encryption_key: UncheckedAccount<'info>,
    /// CHECK: Encrypt event-authority PDA.
    pub event_authority: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RunPayroll<'info> {
    pub vault: Account<'info, DaoVault>,
    #[account(has_one = vault @ GhostPayError::Unauthorized)]
    pub contributor: Account<'info, ContributorRecord>,
    /// CHECK: vault balance ciphertext; must equal vault.balance_ct.
    #[account(mut)]
    pub vault_balance_ct: UncheckedAccount<'info>,
    /// CHECK: contributor salary ciphertext; must equal contributor.salary_ct.
    #[account(mut)]
    pub salary_ct: UncheckedAccount<'info>,
    /// CHECK: fresh ciphertext that will hold the encrypted payment amount.
    #[account(mut)]
    pub payment_ct: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: Encrypt program.
    pub encrypt_program: UncheckedAccount<'info>,
    /// CHECK: Encrypt config PDA.
    pub config: UncheckedAccount<'info>,
    /// CHECK: Encrypt deposit PDA.
    #[account(mut)]
    pub deposit: UncheckedAccount<'info>,
    /// CHECK: This program's CPI-authority PDA.
    pub cpi_authority: UncheckedAccount<'info>,
    /// CHECK: This program's identity.
    pub caller_program: UncheckedAccount<'info>,
    /// CHECK: Encrypt network encryption key account.
    pub network_encryption_key: UncheckedAccount<'info>,
    /// CHECK: Encrypt event-authority PDA.
    pub event_authority: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BenchmarkSalary<'info> {
    pub vault: Account<'info, DaoVault>,
    #[account(has_one = vault @ GhostPayError::Unauthorized)]
    pub contributor: Account<'info, ContributorRecord>,
    /// CHECK: salary ciphertext; must equal contributor.salary_ct.
    #[account(mut)]
    pub salary_ct: UncheckedAccount<'info>,
    /// CHECK: benchmark-median ciphertext supplied by the agent.
    #[account(mut)]
    pub median_ct: UncheckedAccount<'info>,
    /// CHECK: fresh ciphertext for the comparison result.
    #[account(mut)]
    pub result_ct: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: Encrypt program.
    pub encrypt_program: UncheckedAccount<'info>,
    /// CHECK: Encrypt config PDA.
    pub config: UncheckedAccount<'info>,
    /// CHECK: Encrypt deposit PDA.
    #[account(mut)]
    pub deposit: UncheckedAccount<'info>,
    /// CHECK: This program's CPI-authority PDA.
    pub cpi_authority: UncheckedAccount<'info>,
    /// CHECK: This program's identity.
    pub caller_program: UncheckedAccount<'info>,
    /// CHECK: Encrypt network encryption key account.
    pub network_encryption_key: UncheckedAccount<'info>,
    /// CHECK: Encrypt event-authority PDA.
    pub event_authority: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RequestBurnDecrypt<'info> {
    pub vault: Account<'info, DaoVault>,
    #[account(
        mut,
        seeds = [b"batch", vault.key().as_ref(), batch.batch_id.to_le_bytes().as_ref()],
        bump = batch.bump,
        has_one = vault @ GhostPayError::Unauthorized,
    )]
    pub batch: Account<'info, PayrollBatch>,
    /// CHECK: burn-total ciphertext; must equal batch.burn_total_ct.
    pub burn_total_ct: UncheckedAccount<'info>,
    /// CHECK: decryption-request account, created by the Encrypt program.
    #[account(mut)]
    pub request_acct: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: Encrypt program.
    pub encrypt_program: UncheckedAccount<'info>,
    /// CHECK: Encrypt config PDA.
    pub config: UncheckedAccount<'info>,
    /// CHECK: Encrypt deposit PDA.
    #[account(mut)]
    pub deposit: UncheckedAccount<'info>,
    /// CHECK: This program's CPI-authority PDA.
    pub cpi_authority: UncheckedAccount<'info>,
    /// CHECK: This program's identity.
    pub caller_program: UncheckedAccount<'info>,
    /// CHECK: Encrypt network encryption key account.
    pub network_encryption_key: UncheckedAccount<'info>,
    /// CHECK: Encrypt event-authority PDA.
    pub event_authority: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevealBurnTotal<'info> {
    pub vault: Account<'info, DaoVault>,
    #[account(
        mut,
        seeds = [b"batch", vault.key().as_ref(), batch.batch_id.to_le_bytes().as_ref()],
        bump = batch.bump,
        has_one = vault @ GhostPayError::Unauthorized,
    )]
    pub batch: Account<'info, PayrollBatch>,
    pub payer: Signer<'info>,
    /// CHECK: completed decryption-request account; verified against batch digest.
    pub request_acct: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct RevealSalary<'info> {
    pub vault: Account<'info, DaoVault>,
    #[account(
        mut,
        seeds = [b"contributor", vault.key().as_ref(), wallet.key().as_ref()],
        bump = contributor.bump,
        has_one = wallet @ GhostPayError::Unauthorized,
        has_one = vault @ GhostPayError::Unauthorized,
    )]
    pub contributor: Account<'info, ContributorRecord>,
    pub wallet: Signer<'info>,
    /// CHECK: completed decryption-request account; data is parsed and verified
    /// against `contributor.pending_decrypt_digest` inside the instruction.
    pub request_acct: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct RequestSalaryDecrypt<'info> {
    pub vault: Account<'info, DaoVault>,
    #[account(
        mut,
        seeds = [b"contributor", vault.key().as_ref(), wallet.key().as_ref()],
        bump = contributor.bump,
        has_one = wallet @ GhostPayError::Unauthorized,
        has_one = vault @ GhostPayError::Unauthorized,
    )]
    pub contributor: Account<'info, ContributorRecord>,
    pub wallet: Signer<'info>,
    /// CHECK: salary ciphertext; must equal contributor.salary_ct.
    pub salary_ct: UncheckedAccount<'info>,
    /// CHECK: decryption-request account, created by the Encrypt program.
    #[account(mut)]
    pub request_acct: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: Encrypt program.
    pub encrypt_program: UncheckedAccount<'info>,
    /// CHECK: Encrypt config PDA.
    pub config: UncheckedAccount<'info>,
    /// CHECK: Encrypt deposit PDA.
    #[account(mut)]
    pub deposit: UncheckedAccount<'info>,
    /// CHECK: This program's CPI-authority PDA.
    pub cpi_authority: UncheckedAccount<'info>,
    /// CHECK: This program's identity.
    pub caller_program: UncheckedAccount<'info>,
    /// CHECK: Encrypt network encryption key account.
    pub network_encryption_key: UncheckedAccount<'info>,
    /// CHECK: Encrypt event-authority PDA.
    pub event_authority: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

// ── Events ──

/// Emitted by `reveal_salary` once the decryptor network's response is
/// verified. The cleartext lives only in the transaction log — never on chain.
#[event]
pub struct SalaryRevealed {
    pub contributor: Pubkey,
    pub vault: Pubkey,
    pub wallet: Pubkey,
    pub salary: u64,
    pub revealed_at: i64,
}

/// Emitted by `reveal_burn_total` once the decryptor network's response is
/// verified. The cleartext lives only in the transaction log — never on chain.
#[event]
pub struct BurnTotalRevealed {
    pub batch: Pubkey,
    pub vault: Pubkey,
    pub batch_id: u64,
    pub total: u64,
    pub revealed_at: i64,
}

// ── Errors ──

#[error_code]
pub enum GhostPayError {
    #[msg("Vault name exceeds maximum length")]
    NameTooLong,
    #[msg("Salary split percentages must sum to 100")]
    PercentagesMustSumTo100,
    #[msg("Caller is not authorized for this action")]
    Unauthorized,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Arithmetic underflow")]
    Underflow,
    #[msg("Provided ciphertext account does not match the on-chain record")]
    CiphertextMismatch,
    #[msg("Decryption response not yet available or digest mismatch")]
    DecryptionNotComplete,
}
