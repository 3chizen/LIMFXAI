namespace LimfxaiFormal

/-- uint64 maximum, matching the Go ledger height type. -/
def MaxHeight : Nat := 18446744073709551615

/-- Hashes are represented as strings, matching the Go hexadecimal hash. -/
structure BlockHeader where
  height : Nat
  parentHash : String
  hash : String
  deriving Repr, DecidableEq

/-- First committed block: height one, with an empty parent hash. -/
def IsGenesis (block : BlockHeader) : Prop :=
  block.height = 1 ∧ block.parentHash = ""

/-- A child must increment height and reference its parent's hash. -/
def Extends (parent child : BlockHeader) : Prop :=
  child.height = parent.height + 1 ∧
  child.parentHash = parent.hash

/-- Go rejects a commit when the current height is uint64 maximum. -/
def CanCommit (height : Nat) : Prop :=
  height < MaxHeight

theorem genesis_height
    (block : BlockHeader)
    (h : IsGenesis block) :
    block.height = 1 := h.1

theorem genesis_parent_empty
    (block : BlockHeader)
    (h : IsGenesis block) :
    block.parentHash = "" := h.2

theorem extends_height
    (parent child : BlockHeader)
    (h : Extends parent child) :
    child.height = parent.height + 1 := h.1

theorem extends_parent_hash
    (parent child : BlockHeader)
    (h : Extends parent child) :
    child.parentHash = parent.hash := h.2

theorem extends_increases_height
    (parent child : BlockHeader)
    (h : Extends parent child) :
    parent.height < child.height := by
  rw [h.1]
  exact Nat.lt_succ_self parent.height

theorem next_height_within_uint64
    (height : Nat)
    (h : CanCommit height) :
    height + 1 ≤ MaxHeight := by
  exact Nat.succ_le_iff.mpr h

end LimfxaiFormal
