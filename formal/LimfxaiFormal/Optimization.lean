import LimfxaiFormal.DynamicGame

namespace LimfxaiFormal

def IsOptimal {α : Type}
    (utility : α → Int) (choice : α) : Prop :=
  ∀ alternative, utility alternative ≤ utility choice

def IsStrictlyOptimal {α : Type}
    (utility : α → Int) (choice : α) : Prop :=
  ∀ alternative, alternative ≠ choice →
    utility alternative < utility choice

theorem optimal_choice_maximizes_utility
    {α : Type} (utility : α → Int) (choice : α)
    (h : IsOptimal utility choice) :
    ∀ alternative, utility alternative ≤ utility choice := by
  exact h

theorem strictly_optimal_is_optimal
    {α : Type} (utility : α → Int) (choice : α)
    (h : IsStrictlyOptimal utility choice) :
    IsOptimal utility choice := by
  intro alternative
  by_cases heq : alternative = choice
  · subst alternative
    omega
  · have h' := h alternative heq
    omega

theorem optimal_choices_have_equal_utility
    {α : Type} (utility : α → Int) (x y : α)
    (hx : IsOptimal utility x)
    (hy : IsOptimal utility y) :
    utility x = utility y := by
  have hxy := hx y
  have hyx := hy x
  omega

theorem strict_optimum_is_unique
    {α : Type} (utility : α → Int) (x y : α)
    (hx : IsStrictlyOptimal utility x)
    (hy : IsStrictlyOptimal utility y) :
    x = y := by
  by_cases h : x = y
  · exact h
  · have hxy := hx y (Ne.symm h)
    have hyx := hy x h
    omega

theorem optimality_preserved_by_translation
    {α : Type} (utility : α → Int) (constant : Int) (choice : α) :
    IsOptimal (fun x => utility x + constant) choice ↔
      IsOptimal utility choice := by
  constructor
  · intro h
    change ∀ alternative,
      utility alternative + constant ≤ utility choice + constant at h
    intro alternative
    have h' := h alternative
    omega
  · intro h
    change ∀ alternative, utility alternative ≤ utility choice at h
    change ∀ alternative,
      utility alternative + constant ≤ utility choice + constant
    intro alternative
    have h' := h alternative
    omega

end LimfxaiFormal
