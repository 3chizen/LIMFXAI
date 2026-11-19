import LimfxaiFormal.Ledger

namespace LimfxaiFormal

/-- Full block data corresponding to the Go Block fields,
    excluding the stored hash from the committed payload. -/
structure BlockData where
  height : Nat
  parent : String
  transactions : List Transaction
  deriving Repr, DecidableEq

/-- A block payload is valid when its height is nonzero
    and all included transactions satisfy ledger validation. -/
def ValidBlockData (block : BlockData) : Prop :=
  block.height > 0 ∧
    ∀ tx ∈ block.transactions, ValidTransaction tx

/-- Executable validation for block payloads. -/
def validBlockDataB (block : BlockData) : Bool :=
  decide (block.height > 0) &&
    block.transactions.all validTransactionB

/-- Boolean block validation agrees with its logical specification. -/
theorem validBlockDataB_correct (block : BlockData) :
    validBlockDataB block = true ↔ ValidBlockData block := by
  simp [validBlockDataB, ValidBlockData,
    List.all_eq_true, validTransactionB_correct]

/-- Every transaction in a valid block is valid. -/
theorem valid_block_transactions
    (block : BlockData)
    (h : ValidBlockData block) :
    ∀ tx ∈ block.transactions, ValidTransaction tx :=
  h.2

/-- A valid block has a positive height. -/
theorem valid_block_positive_height
    (block : BlockData)
    (h : ValidBlockData block) :
    block.height > 0 :=
  h.1

end LimfxaiFormal
