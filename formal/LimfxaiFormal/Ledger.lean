import LimfxaiFormal.Block

namespace LimfxaiFormal

/-- A transaction preserves Go's nil versus non-nil distinction. -/
structure Transaction where
  key : String
  value : Option String
  delete : Bool
  deriving Repr, DecidableEq

/-- Exact logical validation rules of the Go ledger. -/
def ValidTransaction (tx : Transaction) : Prop :=
  tx.key ≠ "" ∧
    (if tx.delete then tx.value = none else ∃ v, tx.value = some v)

/-- Executable Boolean form of Go transaction validation. -/
def validTransactionB (tx : Transaction) : Bool :=
  decide (tx.key ≠ "") &&
    (if tx.delete then tx.value.isNone else tx.value.isSome)

/-- Boolean validation agrees with the logical specification. -/
theorem validTransactionB_correct (tx : Transaction) :
    validTransactionB tx = true ↔ ValidTransaction tx := by
  cases tx with
  | mk key value delete =>
    cases value with
    | none =>
      cases delete <;> simp [validTransactionB, ValidTransaction]
    | some v =>
      cases delete <;> simp [validTransactionB, ValidTransaction]

/-- Abstract key-value state. None represents an absent key. -/
def State := String → Option String

/-- Apply a transaction to the state. -/
def applyTransaction (state : State) (tx : Transaction) : State :=
  fun query =>
    if query = tx.key then
      if tx.delete then none else tx.value
    else state query

/-- Replay transactions in their original order. -/
def applyTransactions (state : State) (txs : List Transaction) : State :=
  txs.foldl applyTransaction state

/-- Commit only if every transaction is valid. -/
def commitTransactions (state : State) (txs : List Transaction) : Option State :=
  if txs.all validTransactionB then
    some (applyTransactions state txs)
  else none

theorem put_updates_key (state : State) (key value : String) :
    applyTransaction state
      { key := key, value := some value, delete := false } key = some value := by
  simp [applyTransaction]

theorem delete_removes_key (state : State) (key : String) :
    applyTransaction state
      { key := key, value := none, delete := true } key = none := by
  simp [applyTransaction]

theorem put_preserves_other_keys
    (state : State) (key value query : String) (h : query ≠ key) :
    applyTransaction state
      { key := key, value := some value, delete := false } query = state query := by
  simp [applyTransaction, h]

theorem delete_preserves_other_keys
    (state : State) (key query : String) (h : query ≠ key) :
    applyTransaction state
      { key := key, value := none, delete := true } query = state query := by
  simp [applyTransaction, h]

/-- A non-nil empty value is valid for Put. -/
theorem empty_non_nil_put_is_valid (key : String) (h : key ≠ "") :
    ValidTransaction
      { key := key, value := some "", delete := false } := by
  simp [ValidTransaction, h]

/-- A nil value is valid for Delete. -/
theorem nil_delete_is_valid (key : String) (h : key ≠ "") :
    ValidTransaction
      { key := key, value := none, delete := true } := by
  simp [ValidTransaction, h]

/-- Nil value is invalid for Put. -/
theorem nil_put_is_invalid (key : String) (h : key ≠ "") :
    ¬ ValidTransaction
      { key := key, value := none, delete := false } := by
  simp [ValidTransaction, h]

/-- Non-nil value is invalid for Delete. -/
theorem non_nil_delete_is_invalid (key value : String) (h : key ≠ "") :
    ¬ ValidTransaction
      { key := key, value := some value, delete := true } := by
  simp [ValidTransaction, h]

theorem put_put_last_write_wins
    (state : State) (key first second : String) :
    applyTransactions state
      [{ key := key, value := some first, delete := false },
       { key := key, value := some second, delete := false }] key =
      some second := by
  simp [applyTransactions, applyTransaction, List.foldl]

theorem put_delete_last_write_wins
    (state : State) (key value : String) :
    applyTransactions state
      [{ key := key, value := some value, delete := false },
       { key := key, value := none, delete := true }] key = none := by
  simp [applyTransactions, applyTransaction, List.foldl]

theorem delete_put_last_write_wins
    (state : State) (key value : String) :
    applyTransactions state
      [{ key := key, value := none, delete := true },
       { key := key, value := some value, delete := false }] key =
      some value := by
  simp [applyTransactions, applyTransaction, List.foldl]

theorem commit_rejects_invalid_batch (state : State) :
    commitTransactions state
      [{ key := "account", value := some "100", delete := false },
       { key := "", value := none, delete := true }] = none := by
  simp [commitTransactions, validTransactionB]

theorem commit_accepts_valid_batch (state : State) :
    commitTransactions state
      [{ key := "account", value := some "100", delete := false }] =
      some (applyTransactions state
        [{ key := "account", value := some "100", delete := false }]) := by
  simp [commitTransactions, validTransactionB]

theorem commit_accepts_any_valid_batch
    (state : State) (txs : List Transaction)
    (h : txs.all validTransactionB = true) :
    commitTransactions state txs = some (applyTransactions state txs) := by
  simp [commitTransactions, h]

theorem commit_rejects_any_invalid_batch
    (state : State) (txs : List Transaction)
    (h : txs.all validTransactionB = false) :
    commitTransactions state txs = none := by
  simp [commitTransactions, h]

end LimfxaiFormal
