import LimfxaiFormal.WeightedVotingPower

namespace LimfxaiFormal

/-- Permuting a list preserves its total voting power. -/
theorem votingPower_perm
    {α : Type} (weight : α → Nat) (p : α → Bool)
    {xs ys : List α} (h : xs.Perm ys) :
    VotingPower weight p xs = VotingPower weight p ys := by
  induction h with
  | nil =>
      rfl
  | @cons x xs ys h ih =>
      simp [VotingPower, ih]
  | swap x y rest =>
      simp [VotingPower, Nat.add_left_comm, Nat.add_comm]
  | trans h₁ h₂ ih₁ ih₂ =>
      exact ih₁.trans ih₂

end LimfxaiFormal
