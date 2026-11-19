import LimfxaiFormal.Quorum

namespace LimfxaiFormal

/-- Cardinality of the intersection of two quorum predicates
    over one common finite validator list. -/
theorem count_intersection_lower_bound
    {α : Type} (validators : List α)
    (quorumA quorumB : α → Bool) :
    List.countP quorumA validators +
      List.countP quorumB validators ≤
      validators.length +
        List.countP (fun v => quorumA v && quorumB v) validators := by
  induction validators with
  | nil =>
      simp
  | cons v rest ih =>
      rw [List.countP_cons (p := quorumA),
          List.countP_cons (p := quorumB),
          List.countP_cons (p := fun x => quorumA x && quorumB x),
          List.length_cons]
      by_cases ha : quorumA v = true <;>
        by_cases hb : quorumB v = true <;>
        simp [ha, hb] <;> omega

/-- The intersection count splits into Byzantine and honest members. -/
theorem count_intersection_partition
    {α : Type} (validators : List α)
    (quorumA quorumB byzantine : α → Bool) :
    List.countP (fun v => quorumA v && quorumB v) validators =
      List.countP
        (fun v => quorumA v && quorumB v && byzantine v) validators +
      List.countP
        (fun v => quorumA v && quorumB v && !byzantine v) validators := by
  induction validators with
  | nil =>
      simp
  | cons v rest ih =>
      rw [List.countP_cons (p := fun x => quorumA x && quorumB x),
          List.countP_cons
            (p := fun x => quorumA x && quorumB x && byzantine x),
          List.countP_cons
            (p := fun x => quorumA x && quorumB x && !byzantine x)]
      by_cases ha : quorumA v = true <;>
        by_cases hb : quorumB v = true <;>
        by_cases hz : byzantine v = true <;>
        simp [ha, hb, hz] <;> omega

/-- A positive predicate count supplies an actual member of the list. -/
theorem exists_mem_of_countP_pos
    {α : Type} (validators : List α) (p : α → Bool)
    (hpos : 0 < List.countP p validators) :
    ∃ v, v ∈ validators ∧ p v = true := by
  induction validators with
  | nil =>
      simp at hpos
  | cons v rest ih =>
      rw [List.countP_cons] at hpos
      by_cases hp : p v = true
      · exact ⟨v, by simp, hp⟩
      · have hrest : 0 < List.countP p rest := by
          simpa [hp] using hpos
        obtain ⟨w, hw, hwp⟩ := ih hrest
        exact ⟨w, by simp [hw], hwp⟩

/-- If Byzantine members are fewer than the intersection,
    at least one validator in the intersection is honest. -/
theorem quorum_intersection_has_honest_member
    {α : Type} (validators : List α)
    (quorumA quorumB byzantine : α → Bool)
    (faultyBound : Nat)
    (h_intersection :
      faultyBound <
        List.countP (fun v => quorumA v && quorumB v) validators)
    (h_byzantine :
      List.countP
        (fun v => quorumA v && quorumB v && byzantine v) validators
        ≤ faultyBound) :
    ∃ v, v ∈ validators ∧
      quorumA v = true ∧ quorumB v = true ∧ byzantine v = false := by
  have h_partition := count_intersection_partition
    validators quorumA quorumB byzantine
  have h_honest :
      0 < List.countP
        (fun v => quorumA v && quorumB v && !byzantine v) validators := by
    omega
  obtain ⟨v, hv, hpred⟩ :=
    exists_mem_of_countP_pos validators
      (fun x => quorumA x && quorumB x && !byzantine x) h_honest
  have ha : quorumA v = true := by
    cases h : quorumA v <;> simp_all
  have hb : quorumB v = true := by
    cases h : quorumB v <;> simp_all
  have hn : byzantine v = false := by
    cases h : byzantine v <;> simp_all
  exact ⟨v, hv, ha, hb, hn⟩

end LimfxaiFormal

namespace LimfxaiFormal

/--
The count satisfying two predicates cannot exceed
the count satisfying the second predicate alone.
-/
theorem countP_and_le_right
    {α : Type} (validators : List α)
    (p q : α → Bool) :
    List.countP (fun v => p v && q v) validators ≤
      List.countP q validators := by
  induction validators with
  | nil =>
      simp
  | cons v rest ih =>
      rw [List.countP_cons (p := fun x => p x && q x),
          List.countP_cons (p := q)]
      by_cases hp : p v = true <;>
        by_cases hq : q v = true <;>
        simp [hp, hq] <;> omega

end LimfxaiFormal
