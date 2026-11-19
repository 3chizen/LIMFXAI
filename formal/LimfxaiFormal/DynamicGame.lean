import LimfxaiFormal.GameTheory

namespace LimfxaiFormal

/-- A deterministic state transition controlled by an action. -/
abbrev StateTransition (S A : Type) := S → A → S

/-- A policy selects an action at each discrete time step. -/
abbrev DynamicPolicy (A : Type) := Nat → A

/-- State of the system after n transitions. -/
def Trajectory {S A : Type}
    (step : StateTransition S A)
    (initial : S)
    (policy : DynamicPolicy A) : Nat → S
  | 0 => initial
  | n + 1 => step (Trajectory step initial policy n) (policy n)

/-- One-step evolution law. -/
theorem trajectory_succ {S A : Type}
    (step : StateTransition S A)
    (initial : S)
    (policy : DynamicPolicy A)
    (n : Nat) :
    Trajectory step initial policy (n + 1) =
      step (Trajectory step initial policy n) (policy n) := by
  rfl

/-- An invariant is preserved by every permitted transition. -/
def TransitionInvariant {S A : Type}
    (step : StateTransition S A)
    (P : S → Prop) : Prop :=
  ∀ state action, P state → P (step state action)

/-- Every state in the trajectory satisfies a preserved invariant. -/
theorem invariant_holds_along_trajectory
    {S A : Type}
    (step : StateTransition S A)
    (initial : S)
    (policy : DynamicPolicy A)
    (P : S → Prop)
    (h_initial : P initial)
    (h_preserved : TransitionInvariant step P) :
    ∀ n, P (Trajectory step initial policy n) := by
  intro n
  induction n with
  | zero =>
      exact h_initial
  | succ n ih =>
      rw [trajectory_succ]
      exact h_preserved _ _ ih

/-- Utility received at a state-action pair. -/
abbrev StageUtility (S A : Type) := S → A → Int

/-- Total utility accumulated over n transitions. -/
def CumulativeUtility {S A : Type}
    (step : StateTransition S A)
    (utility : StageUtility S A)
    (initial : S)
    (policy : DynamicPolicy A) : Nat → Int
  | 0 => 0
  | n + 1 =>
      CumulativeUtility step utility initial policy n +
      utility (Trajectory step initial policy n) (policy n)

/-- Cumulative utility increases by the utility of the next action. -/
theorem cumulative_utility_succ
    {S A : Type}
    (step : StateTransition S A)
    (utility : StageUtility S A)
    (initial : S)
    (policy : DynamicPolicy A)
    (n : Nat) :
    CumulativeUtility step utility initial policy (n + 1) =
      CumulativeUtility step utility initial policy n +
      utility (Trajectory step initial policy n) (policy n) := by
  rfl

/-- Zero transitions produce zero accumulated utility. -/
theorem cumulative_utility_zero
    {S A : Type}
    (step : StateTransition S A)
    (utility : StageUtility S A)
    (initial : S)
    (policy : DynamicPolicy A) :
    CumulativeUtility step utility initial policy 0 = 0 := by
  rfl

end LimfxaiFormal
