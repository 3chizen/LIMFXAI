import LimfxaiFormal.WeightedVotingPower

namespace LimfxaiFormal

/-- Voting power in the intersection of two validator groups. -/
def IntersectionPower {α : Type}
    (weight : α → Nat) (p q : α → Bool) (xs : List α) : Nat :=
  VotingPower weight (fun v => p v && q v) xs

/-- Every validator belongs to the intersection or to at least
    one of the two groups' complements. -/
theorem intersection_power_lower_bound
    {α : Type} (weight : α → Nat)
    (p q : α → Bool) (xs : List α) :
    VotingPower weight p xs +
      VotingPower weight q xs ≤
    VotingPower weight (fun _ => true) xs +
      IntersectionPower weight p q xs := by
  induction xs with
  | nil => simp [VotingPower, IntersectionPower]
  | cons v rest ih =>
      by_cases hp : p v = true <;>
        by_cases hq : q v = true <;>
        simp [VotingPower, IntersectionPower, hp, hq] at ih ⊢ <;> omega

/-- Two groups whose combined voting power exceeds total power
    must have a nonempty intersection. -/
theorem positive_intersection_power
    {α : Type} (weight : α → Nat)
    (p q : α → Bool) (xs : List α)
    (hCombined :
      VotingPower weight (fun _ => true) xs <
        VotingPower weight p xs +
          VotingPower weight q xs) :
    0 < IntersectionPower weight p q xs := by
  have hBound :=
    intersection_power_lower_bound weight p q xs
  unfold IntersectionPower at hBound ⊢
  omega

end LimfxaiFormal
