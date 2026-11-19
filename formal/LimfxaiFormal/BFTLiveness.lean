import LimfxaiFormal.BFTThreshold

namespace LimfxaiFormal

/--
The honest and Byzantine counts partition a validator list.
Each validator is counted in exactly one of the two groups.
-/
theorem countP_honest_byzantine_partition
    {α : Type} (validators : List α)
    (byzantine : α → Bool) :
    List.countP (fun v => !(byzantine v)) validators +
      List.countP byzantine validators =
        validators.length := by
  induction validators with
  | nil => simp
  | cons v rest ih =>
      rw [List.countP_cons (p := fun x => !(byzantine x)),
          List.countP_cons (p := byzantine)]
      cases hb : byzantine v <;> simp [hb] <;> omega

/--
For n = 3f + 1 and at most f Byzantine validators,
at least 2f + 1 validators are honest.
-/
theorem classic_bft_honest_validator_lower_bound
    {α : Type} (s : ValidatorSet α)
    (byzantine : α → Bool) (f : Nat)
    (hPopulation : BFTPopulation s.members.length f)
    (hGlobalByzantine :
      List.countP byzantine s.members ≤ f) :
    2 * f + 1 ≤
      List.countP (fun v => !(byzantine v)) s.members := by
  have hPartition :=
    countP_honest_byzantine_partition s.members byzantine
  unfold BFTPopulation at hPopulation
  omega


/--
Honest validators are partitioned into responsive and
non-responsive validators.
-/
theorem countP_honest_responsive_partition
    {α : Type} (validators : List α)
    (byzantine responsive : α → Bool) :
    List.countP
        (fun v => !(byzantine v) && responsive v) validators +
      List.countP
        (fun v => !(byzantine v) && !(responsive v)) validators =
      List.countP (fun v => !(byzantine v)) validators := by
  induction validators with
  | nil => simp
  | cons v rest ih =>
      rw [List.countP_cons
            (p := fun x => !(byzantine x) && responsive x),
          List.countP_cons
            (p := fun x => !(byzantine x) && !(responsive x)),
          List.countP_cons
            (p := fun x => !(byzantine x))]
      cases hb : byzantine v <;>
        cases hr : responsive v <;>
        simp [hb, hr] <;> omega

/--
If at most g honest validators are non-responsive,
at least 2*f + 1 - g honest validators are responsive.
-/
theorem classic_bft_responsive_honest_lower_bound
    {α : Type} (s : ValidatorSet α)
    (byzantine responsive : α → Bool) (f g : Nat)
    (hPopulation : BFTPopulation s.members.length f)
    (hGlobalByzantine :
      List.countP byzantine s.members ≤ f)
    (hNonResponsive :
      List.countP
        (fun v => !(byzantine v) && !(responsive v))
        s.members ≤ g) :
    2 * f + 1 ≤
      g + List.countP
        (fun v => !(byzantine v) && responsive v) s.members := by
  have hHonest :=
    classic_bft_honest_validator_lower_bound
      s byzantine f hPopulation hGlobalByzantine
  have hPartition :=
    countP_honest_responsive_partition
      s.members byzantine responsive
  omega


/-- Filtering a list has the same length as its Boolean count. -/
theorem length_filter_eq_countP
    {α : Type} (p : α → Bool) (xs : List α) :
    (List.filter p xs).length = List.countP p xs := by
  induction xs with
  | nil => rfl
  | cons x xs ih =>
      rw [List.filter, List.countP_cons]
      cases hp : p x <;> simp [ih]

/--
A list with at least q matching elements contains a Nodup
sublist of exactly q matching elements.
-/
theorem selected_responsive_quorum
    {α : Type} (xs : List α) (p : α → Bool)
    (hNodup : xs.Nodup) (q : Nat)
    (hEnough : q ≤ List.countP p xs) :
    ∃ selected : List α,
      selected.Sublist xs ∧
      selected.Nodup ∧
      selected.length = q ∧
      ∀ x, x ∈ selected → p x = true := by
  let filtered := List.filter p xs
  have hLength : filtered.length = List.countP p xs := by
    exact length_filter_eq_countP p xs
  refine ⟨filtered.take q, ?_, ?_, ?_, ?_⟩
  · exact (List.take_sublist q filtered).trans List.filter_sublist
  · exact List.Sublist.nodup
      ((List.take_sublist q filtered).trans List.filter_sublist) hNodup
  · rw [List.length_take, hLength, Nat.min_eq_left hEnough]
  · intro x hx
    have hmem : x ∈ filtered := List.mem_of_mem_take hx
    exact (List.mem_filter.mp hmem).2

/--
Under the classic 3f+1 population bound, at most f Byzantine
validators, and full responsiveness of honest validators,
construct an actual honest-responsive quorum of size 2f+1.
-/
theorem classic_bft_construct_responsive_quorum
    {α : Type} (s : ValidatorSet α)
    (byzantine responsive : α → Bool) (f : Nat)
    (hPopulation : BFTPopulation s.members.length f)
    (hGlobalByzantine :
      List.countP byzantine s.members ≤ f)
    (hNoNonResponsiveHonest :
      List.countP
        (fun v => !(byzantine v) && !(responsive v))
        s.members = 0) :
    ∃ selected : List α,
      selected.Sublist s.members ∧
      selected.Nodup ∧
      selected.length = 2 * f + 1 ∧
      ∀ v, v ∈ selected →
        (!(byzantine v) && responsive v) = true := by
  have hResponsive :=
    classic_bft_responsive_honest_lower_bound
      s byzantine responsive f 0
      hPopulation hGlobalByzantine
      (by omega)
  have hEnough :
      2 * f + 1 ≤
        List.countP
          (fun v => !(byzantine v) && responsive v)
          s.members := by
    omega
  exact selected_responsive_quorum
    s.members
    (fun v => !(byzantine v) && responsive v)
    s.nodup (2 * f + 1) hEnough



/--
With at most g non-responsive honest validators, construct a
responsive honest subquorum of size 2*f+1-g.
-/
theorem classic_bft_construct_partial_responsive_quorum
    {α : Type} (s : ValidatorSet α)
    (byzantine responsive : α → Bool) (f g : Nat)
    (hPopulation : BFTPopulation s.members.length f)
    (hGlobalByzantine :
      List.countP byzantine s.members ≤ f)
    (hNonResponsive :
      List.countP
        (fun v => !(byzantine v) && !(responsive v))
        s.members ≤ g)
    (hGBound : g ≤ 2 * f + 1) :
    ∃ selected : List α,
      selected.Sublist s.members ∧
      selected.Nodup ∧
      selected.length = 2 * f + 1 - g ∧
      ∀ v, v ∈ selected →
        (!(byzantine v) && responsive v) = true := by
  have hResponsive :=
    classic_bft_responsive_honest_lower_bound
      s byzantine responsive f g
      hPopulation hGlobalByzantine hNonResponsive
  have hEnough :
      2 * f + 1 - g ≤
        List.countP
          (fun v => !(byzantine v) && responsive v)
          s.members := by
    omega
  exact selected_responsive_quorum
    s.members
    (fun v => !(byzantine v) && responsive v)
    s.nodup (2 * f + 1 - g) hEnough

end LimfxaiFormal
