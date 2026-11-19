import LimfxaiFormal.Probability

namespace LimfxaiFormal

/-- Integer-valued weighted utility over a finite sample list. -/
def WeightedUtility {α : Type} (utility : α → Int) :
    List (α × Nat) → Int
  | [] => 0
  | (outcome, weight) :: rest =>
      Int.ofNat weight * utility outcome +
        WeightedUtility utility rest

/-- The weighted utility of zero utility is zero. -/
theorem weightedUtility_zero
    {α : Type} (samples : List (α × Nat)) :
    WeightedUtility (fun _ : α => (0 : Int)) samples = 0 := by
  induction samples with
  | nil => rfl
  | cons sample rest ih =>
      rcases sample with ⟨x, w⟩
      simp [WeightedUtility, ih]

/-- Weighted utility is additive in the utility function. -/
theorem weightedUtility_add
    {α : Type}
    (u v : α → Int)
    (samples : List (α × Nat)) :
    WeightedUtility (fun x => u x + v x) samples =
      WeightedUtility u samples + WeightedUtility v samples := by
  induction samples with
  | nil => rfl
  | cons sample rest ih =>
      rcases sample with ⟨x, w⟩
      simp [WeightedUtility, ih, Int.mul_add,
        Int.add_assoc, Int.add_comm, Int.add_left_comm]

/-- Negating utility negates its weighted sum. -/
theorem weightedUtility_neg
    {α : Type}
    (u : α → Int)
    (samples : List (α × Nat)) :
    WeightedUtility (fun x => -u x) samples =
      -WeightedUtility u samples := by
  induction samples with
  | nil => rfl
  | cons sample rest ih =>
      rcases sample with ⟨x, w⟩
      simp [WeightedUtility, ih, Int.mul_neg, Int.neg_add]

end LimfxaiFormal

namespace LimfxaiFormal

/-- Exact rational expected utility for a finite weighted sample.
    The positive total weight prevents division by zero. -/
def ExpectedUtility
    {α : Type}
    (utility : α → Int)
    (samples : List (α × Nat))
    (hTotal : 0 < TotalWeight samples) : Rat :=
  Rat.divInt
    (WeightedUtility utility samples)
    (Int.ofNat (TotalWeight samples))

/-- A positive total weight gives a nonzero rational denominator. -/
theorem expectedUtility_denominator_nonzero
    {α : Type}
    (samples : List (α × Nat))
    (hTotal : 0 < TotalWeight samples) :
    Int.ofNat (TotalWeight samples) ≠ 0 := by
  have hpos : 0 < Int.ofNat (TotalWeight samples) :=
    Int.natCast_pos.mpr hTotal
  omega

/-- Expected utility is exactly zero for zero utility. -/
theorem expectedUtility_zero
    {α : Type}
    (samples : List (α × Nat))
    (hTotal : 0 < TotalWeight samples) :
    ExpectedUtility (fun _ : α => (0 : Int)) samples hTotal = 0 := by
  simp [ExpectedUtility, weightedUtility_zero]

end LimfxaiFormal
