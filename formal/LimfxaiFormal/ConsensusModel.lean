import LimfxaiFormal.QuorumSets

namespace LimfxaiFormal

/-- Abstract identity of a proposed block in the consensus protocol. -/
structure ConsensusBlock where
  height : Nat
  round : Nat
  blockId : Nat
  deriving DecidableEq, Repr

/-- Two blocks conflict when they occupy the same height
    but have different block identifiers.
    The conflict relation deliberately ignores round. -/
def BlocksConflict (a b : ConsensusBlock) : Prop :=
  a.height = b.height ∧ a.blockId ≠ b.blockId

theorem blocks_conflict_symmetric
    (a b : ConsensusBlock)
    (h : BlocksConflict a b) :
    BlocksConflict b a := by
  exact ⟨h.1.symm, Ne.symm h.2⟩

theorem blocks_conflict_irrefl
    (a : ConsensusBlock) :
    ¬ BlocksConflict a a := by
  intro h
  exact h.2 rfl

/-- A validator's signature on a particular block. -/
def SignsBlock
    {Validator : Type}
    (signs : Validator → ConsensusBlock → Prop)
    (validator : Validator)
    (block : ConsensusBlock) : Prop :=
  signs validator block

/-- Two conflicting block certificates cannot both be formed
    if the quorum intersection exceeds the Byzantine bound
    and honest validators never double-sign at one height. -/
theorem conflicting_block_certificates_impossible
    {Validator : Type}
    (validators : List Validator)
    (quorumA quorumB byzantine : Validator → Bool)
    (signs : Validator → ConsensusBlock → Prop)
    (blockA blockB : ConsensusBlock)
    (faultyBound : Nat)
    (h_intersection :
      faultyBound <
        List.countP
          (fun v => quorumA v && quorumB v) validators)
    (h_byzantine :
      List.countP
        (fun v => quorumA v && quorumB v && byzantine v)
        validators ≤ faultyBound)
    (h_certificateA :
      ∀ v, quorumA v = true → SignsBlock signs v blockA)
    (h_certificateB :
      ∀ v, quorumB v = true → SignsBlock signs v blockB)
    (h_no_double_sign :
      ∀ v,
        byzantine v = false →
        blockA.height = blockB.height →
        blockA.blockId ≠ blockB.blockId →
        ¬ (SignsBlock signs v blockA ∧
           SignsBlock signs v blockB))
    (h_conflict : BlocksConflict blockA blockB) :
    False := by
  obtain ⟨v, _, hA, hB, hHonest⟩ :=
    quorum_intersection_has_honest_member
      validators quorumA quorumB byzantine faultyBound
      h_intersection h_byzantine
  have hSignA := h_certificateA v hA
  have hSignB := h_certificateB v hB
  exact h_no_double_sign v hHonest h_conflict.1 h_conflict.2
    ⟨hSignA, hSignB⟩

end LimfxaiFormal
