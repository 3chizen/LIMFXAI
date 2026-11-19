import LimfxaiFormal.Optimization

namespace LimfxaiFormal

/-- Every nonempty finite list has an element
    whose utility is at least that of every list member. -/
theorem exists_optimal_of_nonempty_list
    {α : Type} (utility : α → Int) (choices : List α)
    (hchoices : choices ≠ []) :
    ∃ x, x ∈ choices ∧
      ∀ y, y ∈ choices → utility y ≤ utility x := by
  induction choices with
  | nil =>
      contradiction
  | cons a rest ih =>
      by_cases hrest : rest = []
      · subst rest
        refine ⟨a, by simp, ?_⟩
        intro y hy
        have hy' : y = a := by simpa using hy
        subst y
        omega
      · obtain ⟨x, hx, hmax⟩ := ih hrest
        by_cases hax : utility a ≤ utility x
        · refine ⟨x, List.mem_cons.mpr (Or.inr hx), ?_⟩
          intro y hy
          rcases List.mem_cons.mp hy with heq | hmem
          · subst y
            exact hax
          · exact hmax y hmem
        · refine ⟨a, by simp, ?_⟩
          intro y hy
          rcases List.mem_cons.mp hy with heq | hmem
          · subst y
            omega
          · have hle := hmax y hmem
            have hlt : utility x < utility a := by omega
            omega

/-- Every member of a nonempty finite choice list
    is bounded above by an optimal member. -/
theorem finite_choice_has_maximum
    {α : Type} (utility : α → Int) (choices : List α)
    (hchoices : choices ≠ []) :
    ∃ x, x ∈ choices ∧
      ∀ y, y ∈ choices → utility y ≤ utility x := by
  exact exists_optimal_of_nonempty_list utility choices hchoices

end LimfxaiFormal
