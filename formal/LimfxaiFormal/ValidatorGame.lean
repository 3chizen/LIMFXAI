import LimfxaiFormal.GameTheory

namespace LimfxaiFormal

inductive ValidatorAction
  | honest
  | byzantine
  deriving DecidableEq, Repr

def validatorPayoff
    (a b : ValidatorAction) : Int × Int :=
  match a, b with
  | .honest, .honest => (4, 4)
  | .honest, .byzantine => (0, 2)
  | .byzantine, .honest => (2, 0)
  | .byzantine, .byzantine => (-5, -5)

def playerAPayoff (a b : ValidatorAction) : Int :=
  (validatorPayoff a b).1

def playerBPayoff (a b : ValidatorAction) : Int :=
  (validatorPayoff a b).2

theorem honest_dominates_for_A (opponent : ValidatorAction) :
    playerAPayoff .honest opponent ≥
    playerAPayoff .byzantine opponent := by
  cases opponent <;> decide

theorem honest_dominates_for_B (opponent : ValidatorAction) :
    playerBPayoff opponent .honest ≥
    playerBPayoff opponent .byzantine := by
  cases opponent <;> decide

theorem honest_strictly_dominates_for_A (opponent : ValidatorAction) :
    playerAPayoff .honest opponent >
    playerAPayoff .byzantine opponent := by
  cases opponent <;> decide

theorem honest_strictly_dominates_for_B (opponent : ValidatorAction) :
    playerBPayoff opponent .honest >
    playerBPayoff opponent .byzantine := by
  cases opponent <;> decide

theorem honest_honest_is_nash :
    playerAPayoff .honest .honest ≥
      playerAPayoff .byzantine .honest ∧
    playerBPayoff .honest .honest ≥
      playerBPayoff .honest .byzantine := by
  decide

end LimfxaiFormal
