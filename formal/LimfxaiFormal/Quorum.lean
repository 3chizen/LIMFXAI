import LimfxaiFormal.Incentive

namespace LimfxaiFormal

/-- Lower bound on the intersection of two quorums
    in a universe of totalValidators validators. -/
def QuorumIntersectionBound
    (totalValidators quorumA quorumB intersectionSize : Nat) : Prop :=
  intersectionSize + totalValidators >= quorumA + quorumB

/-- The intersection is larger than the Byzantine fault bound
    whenever the two quorum sizes sum to more than n + f. -/
theorem quorum_intersection_exceeds_fault_bound
    (totalValidators faultyBound quorumA quorumB intersectionSize : Nat)
    (h_bound :
      QuorumIntersectionBound totalValidators quorumA quorumB intersectionSize)
    (h_quorum :
      totalValidators + faultyBound < quorumA + quorumB) :
    faultyBound < intersectionSize := by
  dsimp [QuorumIntersectionBound] at h_bound
  omega

/-- Equal-sized quorums satisfy the same threshold when 2q > n + f. -/
theorem equal_quorums_intersection_exceeds_fault_bound
    (totalValidators faultyBound quorumSize intersectionSize : Nat)
    (h_bound :
      QuorumIntersectionBound totalValidators quorumSize quorumSize intersectionSize)
    (h_quorum :
      totalValidators + faultyBound < 2 * quorumSize) :
    faultyBound < intersectionSize := by
  apply quorum_intersection_exceeds_fault_bound
    totalValidators faultyBound quorumSize quorumSize intersectionSize
  · exact h_bound
  · omega

/-- If at most faultyBound members of the intersection are Byzantine,
    a larger intersection contains at least one non-Byzantine member. -/
theorem quorum_intersection_contains_honest_validator
    (faultyBound intersectionSize byzantineInIntersection : Nat)
    (h_size : faultyBound < intersectionSize)
    (h_byzantine :
      byzantineInIntersection <= faultyBound) :
    byzantineInIntersection < intersectionSize := by
  omega

end LimfxaiFormal
