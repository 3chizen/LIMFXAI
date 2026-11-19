import LimfxaiFormal.QuorumSets

namespace LimfxaiFormal

/-- Two block identifiers may be declared conflicting by the protocol. -/
def ConflictingBlocks
    (conflict : Nat → Nat → Prop)
    (blockA blockB : Nat) : Prop :=
  conflict blockA blockB

/-- Conflicting quorum certificates cannot both exist when
    their intersection contains an honest validator and
    honest validators never double-sign conflicting blocks. -/
theorem conflicting_quorum_certificates_impossible
    {α : Type}
    (validators : List α)
    (quorumA quorumB byzantine : α → Bool)
    (signs : α → Nat → Prop)
    (conflict : Nat → Nat → Prop)
    (blockA blockB faultyBound : Nat)
    (h_intersection :
      faultyBound <
        List.countP (fun v => quorumA v && quorumB v) validators)
    (h_byzantine :
      List.countP
        (fun v => quorumA v && quorumB v && byzantine v) validators
        ≤ faultyBound)
    (h_certificateA :
      ∀ v, quorumA v = true → signs v blockA)
    (h_certificateB :
      ∀ v, quorumB v = true → signs v blockB)
    (h_no_double_vote :
      ∀ v, byzantine v = false →
        ConflictingBlocks conflict blockA blockB →
        ¬ (signs v blockA ∧ signs v blockB))
    (h_conflict :
      ConflictingBlocks conflict blockA blockB) :
    False := by
  obtain ⟨v, _, hA, hB, hHonest⟩ :=
    quorum_intersection_has_honest_member
      validators quorumA quorumB byzantine faultyBound
      h_intersection h_byzantine
  have hSignA := h_certificateA v hA
  have hSignB := h_certificateB v hB
  exact h_no_double_vote v hHonest h_conflict
    ⟨hSignA, hSignB⟩

end LimfxaiFormal
