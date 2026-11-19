import LimfxaiFormal.ValidatorSet
import LimfxaiFormal.WeightedVotingPower
import LimfxaiFormal.WeightedPermutation

namespace LimfxaiFormal

/-- A weighted validator-set transition reuses the validated membership transition. -/
structure WeightedValidatorSetTransition (α : Type) [DecidableEq α] where
  membership : ValidatorSetTransition α
  oldWeight : α → Nat
  newWeight : α → Nat
  oldPositive :
    ∀ v, v ∈ membership.oldSet.members → 0 < oldWeight v
  addedPositive :
    ∀ v, v ∈ membership.added → 0 < newWeight v
  retainedWeight :
    ∀ v, v ∈ membership.oldSet.members →
      v ∉ membership.removed → oldWeight v = newWeight v
  newMembersPermutation :
    membership.newSet.members.Perm
      (List.filter (fun v => !(decide (v ∈ membership.removed)))
        membership.oldSet.members ++ membership.added)

/-- A retained validator keeps exactly the same voting weight. -/
theorem weighted_transition_retained_weight_stable
    {α : Type} [DecidableEq α] (t : WeightedValidatorSetTransition α) (v : α)
    (hOld : v ∈ t.membership.oldSet.members)
    (hNotRemoved : v ∉ t.membership.removed) :
    t.oldWeight v = t.newWeight v := by
  exact t.retainedWeight v hOld hNotRemoved

/-- Every validator active after the transition has positive voting weight. -/
theorem weighted_transition_new_member_positive
    {α : Type} [DecidableEq α] (t : WeightedValidatorSetTransition α) (v : α)
    (hNew : v ∈ t.membership.newSet.members) :
    0 < t.newWeight v := by
  have hm := (t.membership.membership v).1 hNew
  rcases hm with ⟨hOld, hNotRemoved⟩ | hAdded
  · rw [← t.retainedWeight v hOld hNotRemoved]
    exact t.oldPositive v hOld
  · exact t.addedPositive v hAdded

/-- The new validator set remains duplicate-free. -/
theorem weighted_transition_new_set_nodup
    {α : Type} [DecidableEq α] (t : WeightedValidatorSetTransition α) :
    t.membership.newSet.members.Nodup := by
  exact t.membership.newSet.nodup

/-- A removed validator cannot remain active after the transition. -/
theorem weighted_transition_removed_is_inactive
    {α : Type} [DecidableEq α] (t : WeightedValidatorSetTransition α) (v : α)
    (hRemoved : v ∈ t.membership.removed) :
    v ∉ t.membership.newSet.members := by
  exact transition_removes_validator t.membership v hRemoved


/-- Permutation-based accounting of the new validator membership. -/
theorem weighted_transition_accounting
    {α : Type} [DecidableEq α] (t : WeightedValidatorSetTransition α) :
    VotingPower t.newWeight (fun _ => true)
      t.membership.newSet.members =
    VotingPower t.newWeight (fun _ => true)
      (List.filter (fun v => !(decide (v ∈ t.membership.removed)))
        t.membership.oldSet.members ++ t.membership.added) := by
  exact votingPower_perm t.newWeight (fun _ => true)
    t.newMembersPermutation



/-- Voting power is additive over concatenated validator lists. -/
theorem weighted_votingPower_append
    {α : Type} (weight : α → Nat) (p : α → Bool)
    (xs ys : List α) :
    VotingPower weight p (xs ++ ys) =
      VotingPower weight p xs + VotingPower weight p ys := by
  induction xs with
  | nil => simp [VotingPower]
  | cons v rest ih =>
      simp [VotingPower, ih, Nat.add_assoc]

/-- Filtering out removed validators preserves their voting power
when every retained validator keeps its weight. -/
theorem weighted_transition_filtered_power_stable
    {α : Type} [DecidableEq α]
    (oldWeight newWeight : α → Nat)
    (removed p : α → Bool) (xs : List α)
    (hStable : ∀ v, v ∈ xs → removed v = false →
      oldWeight v = newWeight v) :
    VotingPower newWeight p (List.filter (fun v => !(removed v)) xs) =
      VotingPower oldWeight p (List.filter (fun v => !(removed v)) xs) := by
  induction xs with
  | nil => simp [VotingPower]
  | cons v rest ih =>
      have hHead := hStable v (by simp)
      have hTail : ∀ u, u ∈ rest → removed u = false →
          oldWeight u = newWeight u := by
        intro u hu hRemoved
        exact hStable u (by simp [hu]) hRemoved
      have ih' := ih hTail
      cases hr : removed v with
      | true =>
          simpa [List.filter, hr] using ih'
      | false =>
          have hw := hHead hr
          simp [List.filter, hr, VotingPower, hw, ih']

theorem weighted_transition_power_conservation
    {α : Type} [DecidableEq α] (t : WeightedValidatorSetTransition α) :
    VotingPower t.newWeight (fun _ => true)
        t.membership.newSet.members
      + VotingPower t.oldWeight
          (fun v => decide (v ∈ t.membership.removed))
          t.membership.oldSet.members
    =
    VotingPower t.oldWeight (fun _ => true)
        t.membership.oldSet.members
      + VotingPower t.newWeight
          (fun v => decide (v ∈ t.membership.added))
          t.membership.added := by
  let removed : α → Bool :=
    fun v => decide (v ∈ t.membership.removed)
  let retained :=
    List.filter (fun v => !(removed v)) t.membership.oldSet.members

  have hNew := weighted_transition_accounting t
  rw [weighted_votingPower_append] at hNew

  have hRetained :
      VotingPower t.newWeight (fun _ => true) retained =
      VotingPower t.oldWeight (fun _ => true) retained := by
    exact weighted_transition_filtered_power_stable
      t.oldWeight t.newWeight removed
      (fun _ => true) t.membership.oldSet.members
      (by
        intro v hv hNotRemoved
        exact t.retainedWeight v hv (of_decide_eq_false hNotRemoved))

  have hPartition :=
    votingPower_filter_removed_partition
      t.oldWeight (fun _ => true) removed
      t.membership.oldSet.members

  have hRemoved :
      VotingPower t.oldWeight (fun _ => true)
        (List.filter removed t.membership.oldSet.members) =
      VotingPower t.oldWeight removed
        t.membership.oldSet.members :=
    votingPower_filter_eq_all
      t.oldWeight removed t.membership.oldSet.members

  have hAddedFilter :
      List.filter
        (fun v => decide (v ∈ t.membership.added))
        t.membership.added = t.membership.added := by
    apply List.filter_eq_self.mpr
    intro v hv
    simp [hv]

  have hAdded :
      VotingPower t.newWeight (fun _ => true)
          t.membership.added =
      VotingPower t.newWeight
          (fun v => decide (v ∈ t.membership.added))
          t.membership.added := by
    calc
      VotingPower t.newWeight (fun _ => true) t.membership.added =
          VotingPower t.newWeight (fun _ => true)
            (List.filter
              (fun v => decide (v ∈ t.membership.added))
              t.membership.added) := by
                exact congrArg
                  (fun xs => VotingPower t.newWeight (fun _ => true) xs)
                  hAddedFilter.symm
      _ = VotingPower t.newWeight
            (fun v => decide (v ∈ t.membership.added))
            t.membership.added :=
          votingPower_filter_eq_all
            t.newWeight
            (fun v => decide (v ∈ t.membership.added))
            t.membership.added

  rw [hNew, hRetained, hAdded, ← hRemoved]
  calc
    (VotingPower t.oldWeight (fun _ => true) retained +
      VotingPower t.newWeight
        (fun v => decide (v ∈ t.membership.added))
        t.membership.added) +
      VotingPower t.oldWeight (fun _ => true)
        (List.filter removed t.membership.oldSet.members)
        =
    (VotingPower t.oldWeight (fun _ => true) retained +
      VotingPower t.oldWeight (fun _ => true)
        (List.filter removed t.membership.oldSet.members)) +
      VotingPower t.newWeight
        (fun v => decide (v ∈ t.membership.added))
        t.membership.added := by
          omega
    _ =
      VotingPower t.oldWeight (fun _ => true)
        t.membership.oldSet.members +
      VotingPower t.newWeight
        (fun v => decide (v ∈ t.membership.added))
        t.membership.added := by
          rw [hPartition]

/-- A balanced transition preserves the total weighted BFT population. -/
theorem weighted_transition_preserves_bft_population
    {α : Type} [DecidableEq α] (t : WeightedValidatorSetTransition α)
    (f : Nat)
    (hOldTotal :
      VotingPower t.oldWeight (fun _ => true)
        t.membership.oldSet.members = 3 * f + 1)
    (hBalanced :
      VotingPower t.oldWeight
        (fun v => decide (v ∈ t.membership.removed))
        t.membership.oldSet.members =
      VotingPower t.newWeight
        (fun v => decide (v ∈ t.membership.added))
        t.membership.added) :
    VotingPower t.newWeight (fun _ => true)
      t.membership.newSet.members = 3 * f + 1 := by
  have hConservation := weighted_transition_power_conservation t
  rw [hBalanced] at hConservation
  omega

/-- The Byzantine voting-power bound survives a balanced validator transition. -/
theorem weighted_transition_byzantine_bound_preserved
    {α : Type} [DecidableEq α] (t : WeightedValidatorSetTransition α)
    (byzantine : α → Bool) (f : Nat)
    (hEntering :
      VotingPower t.newWeight byzantine
        t.membership.added ≤
      VotingPower t.oldWeight byzantine
        (List.filter
          (fun v => decide (v ∈ t.membership.removed))
          t.membership.oldSet.members))
    (hOldBound :
      VotingPower t.oldWeight byzantine
        t.membership.oldSet.members ≤ f) :
    VotingPower t.newWeight byzantine
      t.membership.newSet.members ≤ f := by
  let removed : α → Bool :=
    fun v => decide (v ∈ t.membership.removed)
  let retained :=
    List.filter (fun v => !(removed v)) t.membership.oldSet.members

  have hNew :=
    votingPower_perm t.newWeight byzantine
      t.newMembersPermutation
  rw [weighted_votingPower_append] at hNew

  have hRetained :
      VotingPower t.newWeight byzantine retained =
      VotingPower t.oldWeight byzantine retained := by
    exact weighted_transition_filtered_power_stable
      t.oldWeight t.newWeight removed byzantine
      t.membership.oldSet.members
      (by
        intro v hv hNotRemoved
        exact t.retainedWeight v hv (of_decide_eq_false hNotRemoved))

  have hPartition :=
    votingPower_filter_removed_partition
      t.oldWeight byzantine removed
      t.membership.oldSet.members

  calc
    VotingPower t.newWeight byzantine
        t.membership.newSet.members =
      VotingPower t.newWeight byzantine retained +
        VotingPower t.newWeight byzantine t.membership.added := by
          simpa [retained] using hNew
    _ = VotingPower t.oldWeight byzantine retained +
        VotingPower t.newWeight byzantine t.membership.added := by
          rw [hRetained]
    _ ≤ VotingPower t.oldWeight byzantine retained +
        VotingPower t.oldWeight byzantine
          (List.filter removed t.membership.oldSet.members) :=
          Nat.add_le_add_left hEntering _
    _ = VotingPower t.oldWeight byzantine
        t.membership.oldSet.members := by
          exact hPartition
    _ ≤ f := hOldBound

/--
A validator transition preserves the weighted BFT population and Byzantine
fault bound, while retaining enough responsive honest voting power to
construct a responsive quorum.
-/
theorem weighted_transition_preserves_bft_invariants_and_quorum
    {α : Type} [DecidableEq α] (t : WeightedValidatorSetTransition α)
    (byzantine responsive : α → Bool)
    (f g target : Nat)
    (hOldTotal :
      VotingPower t.oldWeight (fun _ => true)
        t.membership.oldSet.members = 3 * f + 1)
    (hBalanced :
      VotingPower t.oldWeight
        (fun v => decide (v ∈ t.membership.removed))
        t.membership.oldSet.members =
      VotingPower t.newWeight
        (fun v => decide (v ∈ t.membership.added))
        t.membership.added)
    (hEntering :
      VotingPower t.newWeight byzantine
        t.membership.added ≤
      VotingPower t.oldWeight byzantine
        (List.filter
          (fun v => decide (v ∈ t.membership.removed))
          t.membership.oldSet.members))
    (hOldByzantine :
      VotingPower t.oldWeight byzantine
        t.membership.oldSet.members ≤ f)
    (hNewNonResponsive :
      VotingPower t.newWeight
        (fun v => !(byzantine v) && !(responsive v))
        t.membership.newSet.members ≤ g)
    (hTarget : g + target ≤ 2 * f + 1)
    (hNewNodup : t.membership.newSet.members.Nodup) :
    VotingPower t.newWeight (fun _ => true)
        t.membership.newSet.members = 3 * f + 1 ∧
    VotingPower t.newWeight byzantine
        t.membership.newSet.members ≤ f ∧
    ∃ selected : List α,
      selected.Sublist t.membership.newSet.members ∧
      selected.Nodup ∧
      target ≤ VotingPower t.newWeight (fun _ => true) selected ∧
      ∀ v, v ∈ selected →
        (!(byzantine v) && responsive v) = true := by
  have hNewTotal :=
    weighted_transition_preserves_bft_population
      t f hOldTotal hBalanced
  have hNewByzantine :=
    weighted_transition_byzantine_bound_preserved
      t byzantine f hEntering hOldByzantine
  refine ⟨hNewTotal, hNewByzantine, ?_⟩
  exact weighted_bft_construct_responsive_quorum
    t.membership.newSet.members
    t.newWeight byzantine responsive f g target
    hNewNodup hNewTotal hNewByzantine
    hNewNonResponsive hTarget

/-! ## Concrete weighted validator transition example -/

/-- Five validators used in the transition demonstration. -/
inductive WeightedTransitionDemoValidator
  | a | b | c | d | e
  deriving DecidableEq, Repr

open WeightedTransitionDemoValidator

def transitionDemoOld :
    List WeightedTransitionDemoValidator := [.a, .b, .c, .e]

def transitionDemoNew :
    List WeightedTransitionDemoValidator := [.a, .b, .e, .d]

def transitionDemoAdded :
    List WeightedTransitionDemoValidator := [.d]

def transitionDemoRemoved :
    List WeightedTransitionDemoValidator := [.c]

def transitionDemoOldWeight :
    WeightedTransitionDemoValidator → Nat
  | .a => 2
  | .b => 3
  | .c => 2
  | .d => 0
  | .e => 3

def transitionDemoNewWeight :
    WeightedTransitionDemoValidator → Nat
  | .a => 2
  | .b => 3
  | .c => 0
  | .d => 2
  | .e => 3

def transitionDemoByzantine :
    WeightedTransitionDemoValidator → Bool
  | .a => true
  | _ => false

def transitionDemoResponsive :
    WeightedTransitionDemoValidator → Bool := fun _ => true

/-- The membership transition removes C and adds D. -/
def transitionDemoMembership :
    ValidatorSetTransition WeightedTransitionDemoValidator where
  oldSet := ⟨transitionDemoOld, by decide⟩
  newSet := ⟨transitionDemoNew, by decide⟩
  added := transitionDemoAdded
  removed := transitionDemoRemoved
  added_nodup := by decide
  removed_nodup := by decide
  added_disjoint_old := by
    intro v hv
    cases v <;> simp [transitionDemoAdded, transitionDemoOld] at *
  removed_subset_old := by
    intro v hv
    cases v <;> simp [transitionDemoRemoved, transitionDemoOld] at *
  added_disjoint_removed := by
    intro v hv
    cases v <;> simp [transitionDemoAdded, transitionDemoRemoved] at *
  membership := by
    intro v
    cases v <;>
      simp [transitionDemoOld, transitionDemoNew,
        transitionDemoAdded, transitionDemoRemoved]

/-- A fully specified weighted transition with positive active weights. -/
def transitionDemo :
    WeightedValidatorSetTransition WeightedTransitionDemoValidator where
  membership := transitionDemoMembership
  oldWeight := transitionDemoOldWeight
  newWeight := transitionDemoNewWeight
  oldPositive := by
    intro v hv
    cases v <;>
      simp [transitionDemoMembership, transitionDemoOld,
        transitionDemoOldWeight] at hv ⊢
  addedPositive := by
    intro v hv
    cases v <;>
      simp [transitionDemoMembership, transitionDemoAdded,
        transitionDemoNewWeight] at hv ⊢
  retainedWeight := by
    intro v hv hr
    cases v <;>
      simp [transitionDemoMembership, transitionDemoOld,
        transitionDemoRemoved, transitionDemoOldWeight,
        transitionDemoNewWeight] at hv hr ⊢
  newMembersPermutation := by
    change transitionDemoNew.Perm
      (List.filter
        (fun v => !(decide (v ∈ transitionDemoRemoved)))
        transitionDemoOld ++ transitionDemoAdded)
    simp [transitionDemoNew, transitionDemoOld,
      transitionDemoRemoved, transitionDemoAdded]

/-- The old and new validator sets both have total power ten. -/
example :
    VotingPower transitionDemoOldWeight (fun _ => true)
      transitionDemoOld = 10 := by
  decide

example :
    VotingPower transitionDemoNewWeight (fun _ => true)
      transitionDemoNew = 10 := by
  decide

/-- Byzantine voting power remains two after the transition. -/
example :
    VotingPower transitionDemoNewWeight transitionDemoByzantine
      transitionDemoNew = 2 := by
  decide

/-- The responsive honest validators carry eight voting power. -/
example :
    VotingPower transitionDemoNewWeight
      (fun v => !transitionDemoByzantine v &&
        transitionDemoResponsive v)
      transitionDemoNew = 8 := by
  decide

/-- The combined transition theorem constructs a responsive quorum. -/
theorem transition_demo_preserves_weighted_bft :
    VotingPower transitionDemoNewWeight (fun _ => true)
      transitionDemoNew = 10 ∧
    VotingPower transitionDemoNewWeight transitionDemoByzantine
      transitionDemoNew ≤ 3 ∧
    ∃ selected : List WeightedTransitionDemoValidator,
      selected.Sublist transitionDemoNew ∧
      selected.Nodup ∧
      7 ≤ VotingPower transitionDemoNewWeight
        (fun _ => true) selected ∧
      ∀ v, v ∈ selected →
        (!transitionDemoByzantine v &&
          transitionDemoResponsive v) = true := by
  apply weighted_transition_preserves_bft_invariants_and_quorum
    transitionDemo transitionDemoByzantine transitionDemoResponsive
    3 0 7
  · decide
  · decide
  · decide
  · decide
  · decide
  · decide
  · decide

/-- The constructed responsive honest set is exactly B, D and E. -/
example :
    List.filter
      (fun v => !transitionDemoByzantine v &&
        transitionDemoResponsive v)
      transitionDemoNew = [.b, .e, .d] := by
  decide

/-- The selected responsive honest validators exceed two-thirds. -/
example :
    2 * 10 <
      3 * VotingPower transitionDemoNewWeight
        (fun v => !transitionDemoByzantine v &&
          transitionDemoResponsive v)
        transitionDemoNew := by
  decide

end LimfxaiFormal
