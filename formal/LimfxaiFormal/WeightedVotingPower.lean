import LimfxaiFormal.BFTLiveness

namespace LimfxaiFormal

/-- Total voting power of validators satisfying a Boolean predicate. -/
def VotingPower {α : Type} (weight : α → Nat)
    (p : α → Bool) : List α → Nat
  | [] => 0
  | v :: rest =>
      (if p v then weight v else 0) +
        VotingPower weight p rest

/-- Positive voting power contains a validator with positive weight. -/
theorem exists_mem_of_votingPower_pos
    {α : Type} (weight : α → Nat)
    (p : α → Bool) (xs : List α)
    (h : 0 < VotingPower weight p xs) :
    ∃ v, v ∈ xs ∧ p v = true ∧ 0 < weight v := by
  induction xs with
  | nil =>
      simp [VotingPower] at h
  | cons v rest ih =>
      cases hp : p v with
      | false =>
          have hrest : 0 < VotingPower weight p rest := by
            simp [VotingPower, hp] at h
            omega
          obtain ⟨u, hu, hpu, hwu⟩ := ih hrest
          exact ⟨u, by simp [hu], hpu, hwu⟩
      | true =>
          by_cases hw : 0 < weight v
          · exact ⟨v, by simp, hp, hw⟩
          · have hw0 : weight v = 0 := by omega
            have hrest : 0 < VotingPower weight p rest := by
              simp [VotingPower, hp, hw0] at h
              omega
            obtain ⟨u, hu, hpu, hwu⟩ := ih hrest
            exact ⟨u, by simp [hu], hpu, hwu⟩

/-- Every validator's voting power belongs to exactly one side
    of a Boolean partition. -/
theorem votingPower_partition
    {α : Type} (weight : α → Nat)
    (p : α → Bool) (xs : List α) :
    VotingPower weight p xs +
      VotingPower weight (fun v => !(p v)) xs =
      VotingPower weight (fun _ => true) xs := by
  induction xs with
  | nil => rfl
  | cons v rest ih =>
      simp only [VotingPower]
      by_cases hp : p v = true
      · simp [VotingPower, hp] at ih ⊢
        omega
      · simp [VotingPower, hp] at ih ⊢
        omega

/-- Honest voting power is partitioned into responsive and
    non-responsive honest voting power. -/
theorem votingPower_honest_responsive_partition
    {α : Type} (weight : α → Nat)
    (byzantine responsive : α → Bool)
    (xs : List α) :
    VotingPower weight
        (fun v => !(byzantine v) && responsive v) xs +
      VotingPower weight
        (fun v => !(byzantine v) && !(responsive v)) xs =
      VotingPower weight (fun v => !(byzantine v)) xs := by
  induction xs with
  | nil => rfl
  | cons v rest ih =>
      simp only [VotingPower]
      by_cases hb : byzantine v = true
      · simp [VotingPower, hb] at ih ⊢
        omega
      · by_cases hr : responsive v = true
        · simp [VotingPower, hb, hr] at ih ⊢
          omega
        · simp [VotingPower, hb, hr] at ih ⊢
          omega

/-- Under a 3f+1 total voting-power model, at most f Byzantine
    power and at most g non-responsive honest power imply
    at least 2f+1-g responsive honest voting power. -/
theorem weighted_bft_responsive_honest_lower_bound
    {α : Type} (xs : List α)
    (weight : α → Nat)
    (byzantine responsive : α → Bool)
    (f g : Nat)
    (hTotal :
      VotingPower weight (fun _ => true) xs = 3 * f + 1)
    (hByzantine :
      VotingPower weight byzantine xs ≤ f)
    (hNonResponsive :
      VotingPower weight
        (fun v => !(byzantine v) && !(responsive v)) xs ≤ g) :
    2 * f + 1 ≤
      g + VotingPower weight
        (fun v => !(byzantine v) && responsive v) xs := by
  have hFaultPartition :=
    votingPower_partition weight byzantine xs
  have hHonest :
      2 * f + 1 ≤
        VotingPower weight (fun v => !(byzantine v)) xs := by
    omega
  have hResponsivePartition :=
    votingPower_honest_responsive_partition
      weight byzantine responsive xs
  omega

/--
If the unavailable honest voting power plus a target quorum
does not exceed 2*f+1, responsive honest validators have
enough voting power to meet that target.
-/
theorem weighted_bft_responsive_quorum_available
    {α : Type} (xs : List α)
    (weight : α → Nat)
    (byzantine responsive : α → Bool)
    (f g target : Nat)
    (hTotal :
      VotingPower weight (fun _ => true) xs = 3 * f + 1)
    (hByzantine :
      VotingPower weight byzantine xs ≤ f)
    (hNonResponsive :
      VotingPower weight
        (fun v => !(byzantine v) && !(responsive v)) xs ≤ g)
    (hTarget : g + target ≤ 2 * f + 1) :
    target ≤
      VotingPower weight
        (fun v => !(byzantine v) && responsive v) xs := by
  have hLower :=
    weighted_bft_responsive_honest_lower_bound
      xs weight byzantine responsive f g
      hTotal hByzantine hNonResponsive
  omega

/-- Filtering by a Boolean predicate preserves its total voting power
    when every selected element is counted. -/
theorem votingPower_filter_eq_all
    {α : Type} (weight : α → Nat)
    (p : α → Bool) (xs : List α) :
    VotingPower weight (fun _ => true) (List.filter p xs) =
      VotingPower weight p xs := by
  induction xs with
  | nil => rfl
  | cons v rest ih =>
      cases hp : p v <;>
        simp [List.filter, VotingPower, hp, ih]

/--
Construct the actual responsive validator sublist.
It preserves uniqueness and carries at least the target
voting power.
-/
theorem weighted_responsive_validator_sublist
    {α : Type} (xs : List α)
    (weight : α → Nat) (p : α → Bool)
    (hNodup : xs.Nodup) (target : Nat)
    (hEnough : target ≤ VotingPower weight p xs) :
    ∃ selected : List α,
      selected.Sublist xs ∧
      selected.Nodup ∧
      target ≤ VotingPower weight (fun _ => true) selected ∧
      ∀ v, v ∈ selected → p v = true := by
  let selected := List.filter p xs
  refine ⟨selected, ?_, ?_, ?_, ?_⟩
  · exact List.filter_sublist
  · exact List.Sublist.nodup List.filter_sublist hNodup
  · dsimp [selected]
    rw [votingPower_filter_eq_all]
    exact hEnough
  · intro v hv
    exact (List.mem_filter.mp hv).2

/--
Construct a Nodup sublist of responsive honest validators
whose total voting power reaches the requested target.
-/
theorem weighted_bft_construct_responsive_quorum
    {α : Type} (xs : List α)
    (weight : α → Nat)
    (byzantine responsive : α → Bool)
    (f g target : Nat)
    (hNodup : xs.Nodup)
    (hTotal :
      VotingPower weight (fun _ => true) xs = 3 * f + 1)
    (hByzantine :
      VotingPower weight byzantine xs ≤ f)
    (hNonResponsive :
      VotingPower weight
        (fun v => !(byzantine v) && !(responsive v)) xs ≤ g)
    (hTarget : g + target ≤ 2 * f + 1) :
    ∃ selected : List α,
      selected.Sublist xs ∧
      selected.Nodup ∧
      target ≤ VotingPower weight (fun _ => true) selected ∧
      ∀ v, v ∈ selected →
        (!(byzantine v) && responsive v) = true := by
  have hEnough :=
    weighted_bft_responsive_quorum_available
      xs weight byzantine responsive f g target
      hTotal hByzantine hNonResponsive hTarget
  exact weighted_responsive_validator_sublist
    xs weight
    (fun v => !(byzantine v) && responsive v)
    hNodup target hEnough

/-- Four-validator example for constructive weighted BFT liveness. -/
inductive WeightedDemoValidator
  | a | b | c | d
  deriving DecidableEq, Repr

def weightedDemoValidators : List WeightedDemoValidator :=
  [.a, .b, .c, .d]

def weightedDemoWeight (_ : WeightedDemoValidator) : Nat := 1

def weightedDemoByzantine : WeightedDemoValidator → Bool
  | .a => true
  | _ => false

def weightedDemoResponsive : WeightedDemoValidator → Bool
  | .c => false
  | _ => true

/-- The construction succeeds with two responsive honest validators. -/
example :
    ∃ selected : List WeightedDemoValidator,
      selected.Sublist weightedDemoValidators ∧
      selected.Nodup ∧
      2 ≤ VotingPower weightedDemoWeight (fun _ => true) selected ∧
      ∀ v, v ∈ selected →
        (!(weightedDemoByzantine v) && weightedDemoResponsive v) = true := by
  exact weighted_bft_construct_responsive_quorum
    weightedDemoValidators weightedDemoWeight
    weightedDemoByzantine weightedDemoResponsive
    1 1 2
    (by decide)
    (by decide)
    (by decide)
    (by decide)
    (by decide)


/-- Exact selected validator list for the four-validator example. -/
example :
    List.filter
      (fun v => !(weightedDemoByzantine v) &&
        weightedDemoResponsive v)
      weightedDemoValidators = [.b, .d] := by
  decide

/-- The exact selected list has voting power two. -/
example :
    VotingPower weightedDemoWeight (fun _ => true) [.b, .d] = 2 := by
  decide


/-- Non-uniform voting power for the weighted BFT example. -/
def weightedNonUniformDemoWeight : WeightedDemoValidator → Nat
  | .a => 2
  | .b => 1
  | .c => 1
  | .d => 3

/-- Weighted BFT liveness with total power seven and fault power two. -/
example :
    ∃ selected : List WeightedDemoValidator,
      selected.Sublist weightedDemoValidators ∧
      selected.Nodup ∧
      4 ≤ VotingPower weightedNonUniformDemoWeight
        (fun _ => true) selected ∧
      ∀ v, v ∈ selected →
        (!(weightedDemoByzantine v) &&
          weightedDemoResponsive v) = true := by
  exact weighted_bft_construct_responsive_quorum
    weightedDemoValidators weightedNonUniformDemoWeight
    weightedDemoByzantine weightedDemoResponsive
    2 1 4
    (by decide)
    (by decide)
    (by decide)
    (by decide)
    (by decide)

/-- The non-uniform example selects exactly b and d. -/
example :
    List.filter
      (fun v => !(weightedDemoByzantine v) &&
        weightedDemoResponsive v)
      weightedDemoValidators = [.b, .d] := by
  decide

/-- The selected validators carry exactly four voting power. -/
example :
    VotingPower weightedNonUniformDemoWeight
      (fun _ => true) [.b, .d] = 4 := by
  decide


/-- Byzantine voting power splits across retained and removed validators. -/
theorem votingPower_filter_removed_partition
    {α : Type} (weight : α → Nat) (byzantine removed : α → Bool)
    (xs : List α) :
    VotingPower weight byzantine
        (List.filter (fun v => !(removed v)) xs)
      +
    VotingPower weight byzantine
        (List.filter removed xs)
      =
    VotingPower weight byzantine xs := by
  induction xs with
  | nil => rfl
  | cons v rest ih =>
      cases hr : removed v <;>
        simp [List.filter, VotingPower, hr, ih] <;> omega

end LimfxaiFormal
