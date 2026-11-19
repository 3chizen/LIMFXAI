import LimfxaiFormal.ValidatorQuorum

namespace LimfxaiFormal

/-- Classic BFT population: n = 3f + 1. -/
def BFTPopulation (n f : Nat) : Prop :=
  n = 3 * f + 1

/-- Classic BFT quorum threshold: q = 2f + 1. -/
def BFTQuorumThreshold (q f : Nat) : Prop :=
  q = 2 * f + 1

/--
For n = 3f + 1 and two quorums of size at least 2f + 1,
their intersection contains at least f + 1 validators.
-/
theorem classic_bft_intersection_bound
    {α : Type} (s : ValidatorSet α)
    (quorumA quorumB : α → Bool) (f : Nat)
    (hPopulation : BFTPopulation s.members.length f)
    (hQuorumA :
      2 * f + 1 ≤ ValidatorQuorumSize s quorumA)
    (hQuorumB :
      2 * f + 1 ≤ ValidatorQuorumSize s quorumB) :
    f + 1 ≤
      List.countP (fun v => quorumA v && quorumB v) s.members := by
  have hIntersection :=
    validator_quorum_intersection_exceeds_fault_bound
      s quorumA quorumB f (by
        unfold BFTPopulation at hPopulation
        unfold ValidatorQuorumSize at hQuorumA hQuorumB
        unfold ValidatorQuorumSize
        omega)
  omega

/--
If at most f validators in the intersection are Byzantine,
an honest validator belongs to both quorums.
-/
theorem classic_bft_honest_intersection
    {α : Type} (s : ValidatorSet α)
    (quorumA quorumB byzantine : α → Bool) (f : Nat)
    (hPopulation : BFTPopulation s.members.length f)
    (hQuorumA :
      2 * f + 1 ≤ ValidatorQuorumSize s quorumA)
    (hQuorumB :
      2 * f + 1 ≤ ValidatorQuorumSize s quorumB)
    (hByzantine :
      List.countP
        (fun v => quorumA v && quorumB v && byzantine v)
        s.members ≤ f) :
    ∃ v, v ∈ s.members ∧
      quorumA v = true ∧ quorumB v = true ∧ byzantine v = false := by
  apply validator_quorum_has_honest_intersection
    s quorumA quorumB byzantine f
  · unfold BFTPopulation at hPopulation
    unfold ValidatorQuorumSize at hQuorumA hQuorumB
    unfold ValidatorQuorumSize
    omega
  · exact hByzantine

end LimfxaiFormal

namespace LimfxaiFormal

/--
A global Byzantine population bound implies the same bound
for Byzantine validators in the intersection of two quorums.
-/
theorem classic_bft_honest_intersection_global_fault_bound
    {α : Type} (s : ValidatorSet α)
    (quorumA quorumB byzantine : α → Bool) (f : Nat)
    (hPopulation : BFTPopulation s.members.length f)
    (hQuorumA :
      2 * f + 1 ≤ ValidatorQuorumSize s quorumA)
    (hQuorumB :
      2 * f + 1 ≤ ValidatorQuorumSize s quorumB)
    (hGlobalByzantine :
      List.countP byzantine s.members ≤ f) :
    ∃ v, v ∈ s.members ∧
      quorumA v = true ∧ quorumB v = true ∧ byzantine v = false := by
  apply classic_bft_honest_intersection
    s quorumA quorumB byzantine f
    hPopulation hQuorumA hQuorumB
  have hLocal :=
    countP_and_le_right s.members
      (fun v => quorumA v && quorumB v) byzantine
  omega

end LimfxaiFormal
