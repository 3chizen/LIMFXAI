import LimfxaiFormal.Ledger

namespace LimfxaiFormal

/-- Execute a transaction batch using the ledger's existing transition function. -/
def executeBatch (initial : State) (txs : List Transaction) : State :=
  applyTransactions initial txs

/-- The empty batch leaves every state unchanged. -/
theorem executeBatch_empty (initial : State) :
    executeBatch initial [] = initial := by
  funext key
  simp [executeBatch, applyTransactions]

/-- Executing a batch is compositional across a prefix and suffix. -/
theorem executeBatch_append
    (initial : State) (firstBatch secondBatch : List Transaction) :
    executeBatch initial (firstBatch ++ secondBatch) =
      executeBatch (executeBatch initial firstBatch) secondBatch := by
  funext key
  simp [executeBatch, applyTransactions, List.foldl_append]

/-- Equal initial states and equal ordered batches have equal final states. -/
theorem executeBatch_deterministic
    (initial₁ initial₂ : State)
    (txs₁ txs₂ : List Transaction)
    (hInitial : initial₁ = initial₂)
    (hTransactions : txs₁ = txs₂) :
    executeBatch initial₁ txs₁ = executeBatch initial₂ txs₂ := by
  subst initial₂
  subst txs₂
  rfl

/-- A successful commit returns the complete replay result, never a prefix. -/
theorem commit_result_is_full_replay
    (initial : State) (txs : List Transaction) (committed : State)
    (h : commitTransactions initial txs = some committed) :
    committed = applyTransactions initial txs := by
  unfold commitTransactions at h
  split at h
  · injection h with result
    exact result.symm
  · contradiction

/-- A valid concatenated batch commits to the complete ordered execution. -/
theorem commit_valid_append
    (initial : State) (firstBatch secondBatch : List Transaction)
    (hValid : (firstBatch ++ secondBatch).all validTransactionB = true) :
    commitTransactions initial (firstBatch ++ secondBatch) =
      some (executeBatch initial (firstBatch ++ secondBatch)) := by
  simp [commitTransactions, executeBatch, hValid]

end LimfxaiFormal
