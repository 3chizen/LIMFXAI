import LimfxaiFormal.Block

namespace LimfxaiFormal

/-- Every block in a valid tail extends its immediate predecessor. -/
def ValidTail (parent : BlockHeader) : List BlockHeader → Prop
  | [] => True
  | child :: rest =>
      Extends parent child ∧ ValidTail child rest

/-- A valid chain starts with genesis and has a valid successor tail. -/
def ValidChain (blocks : List BlockHeader) : Prop :=
  match blocks with
  | [] => False
  | genesis :: rest =>
      IsGenesis genesis ∧ ValidTail genesis rest

/-- The first block of a valid chain is a genesis block. -/
theorem validChain_starts_at_genesis
    (blocks : List BlockHeader)
    (h : ValidChain blocks) :
    ∃ genesis, blocks.head? = some genesis ∧ IsGenesis genesis := by
  cases blocks with
  | nil =>
      exact False.elim h
  | cons genesis rest =>
      exact ⟨genesis, rfl, h.1⟩

/-- The first successor must extend its predecessor. -/
theorem validTail_head_extends
    (parent child : BlockHeader)
    (rest : List BlockHeader)
    (h : ValidTail parent (child :: rest)) :
    Extends parent child := h.1

/-- A valid successor tail remains valid after removing its head. -/
theorem validTail_suffix
    (parent child : BlockHeader)
    (rest : List BlockHeader)
    (h : ValidTail parent (child :: rest)) :
    ValidTail child rest := h.2

/-- Every block in a valid tail has a strictly greater height
    than the block from which that tail starts. -/
theorem validTail_every_later_height_increases
    (parent : BlockHeader) :
    ∀ (blocks : List BlockHeader),
      ValidTail parent blocks →
      ∀ b ∈ blocks, parent.height < b.height := by
  intro blocks
  induction blocks generalizing parent with
  | nil =>
      intro h b hb
      simp at hb
  | cons child rest ih =>
      intro h b hb
      have hStep : parent.height < child.height :=
        extends_increases_height parent child h.1
      have hRest : ∀ x ∈ rest, parent.height < x.height := by
        intro x hx
        exact Nat.lt_trans hStep (ih child h.2 x hx)
      simp only [List.mem_cons] at hb
      rcases hb with rfl | hb
      · exact hStep
      · exact hRest b hb

/-- Every non-genesis block in a valid chain has height greater than one. -/
theorem validChain_later_blocks_above_genesis
    (genesis : BlockHeader)
    (rest : List BlockHeader)
    (h : ValidChain (genesis :: rest)) :
    ∀ b ∈ rest, 1 < b.height := by
  have hGenesis : genesis.height = 1 := h.1.1
  intro b hb
  rw [← hGenesis]
  exact validTail_every_later_height_increases genesis rest h.2 b hb

end LimfxaiFormal
