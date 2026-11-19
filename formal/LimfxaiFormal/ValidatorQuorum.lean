import LimfxaiFormal.ValidatorSet
import LimfxaiFormal.QuorumSets

namespace LimfxaiFormal

/--
A quorum is measured over a well-formed validator set.
The Nodup invariant is carried by ValidatorSet.
-/
def ValidatorQuorumSize
    {α : Type} (s : ValidatorSet α) (quorum : α → Bool) : Nat :=
  List.countP quorum s.members

/--
If two quorum sizes exceed the validator population plus the
Byzantine fault bound, their intersection contains more than
the fault bound.
-/
theorem validator_quorum_intersection_exceeds_fault_bound
    {α : Type} (s : ValidatorSet α)
    (quorumA quorumB : α → Bool)
    (faultyBound : Nat)
    (hQuorumSum :
      faultyBound + s.members.length <
        ValidatorQuorumSize s quorumA +
        ValidatorQuorumSize s quorumB) :
    faultyBound <
      List.countP (fun v => quorumA v && quorumB v) s.members := by
  have hLower :=
    count_intersection_lower_bound s.members quorumA quorumB
  unfold ValidatorQuorumSize at hQuorumSum
  omega

/--
Two sufficiently large quorums over a unique validator set
share at least one honest validator, provided the Byzantine
members in their intersection do not exceed faultyBound.
-/
theorem validator_quorum_has_honest_intersection
    {α : Type} (s : ValidatorSet α)
    (quorumA quorumB byzantine : α → Bool)
    (faultyBound : Nat)
    (hQuorumSum :
      faultyBound + s.members.length <
        ValidatorQuorumSize s quorumA +
        ValidatorQuorumSize s quorumB)
    (hByzantine :
      List.countP
        (fun v => quorumA v && quorumB v && byzantine v)
        s.members ≤ faultyBound) :
    ∃ v, v ∈ s.members ∧
      quorumA v = true ∧ quorumB v = true ∧ byzantine v = false := by
  have hIntersection :=
    validator_quorum_intersection_exceeds_fault_bound
      s quorumA quorumB faultyBound hQuorumSum
  exact quorum_intersection_has_honest_member
    s.members quorumA quorumB byzantine faultyBound
    hIntersection hByzantine

/--
The same safety premise applies to the new validator set
after a valid validator-set transition.
-/
theorem transitioned_validator_quorum_has_honest_intersection
    {α : Type} (t : ValidatorSetTransition α)
    (quorumA quorumB byzantine : α → Bool)
    (faultyBound : Nat)
    (hQuorumSum :
      faultyBound + t.newSet.members.length <
        ValidatorQuorumSize t.newSet quorumA +
        ValidatorQuorumSize t.newSet quorumB)
    (hByzantine :
      List.countP
        (fun v => quorumA v && quorumB v && byzantine v)
        t.newSet.members ≤ faultyBound) :
    ∃ v, v ∈ t.newSet.members ∧
      quorumA v = true ∧ quorumB v = true ∧ byzantine v = false := by
  exact validator_quorum_has_honest_intersection
    t.newSet quorumA quorumB byzantine faultyBound
    hQuorumSum hByzantine

end LimfxaiFormal
