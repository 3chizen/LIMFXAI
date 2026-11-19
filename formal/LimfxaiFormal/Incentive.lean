import LimfxaiFormal.ValidatorGame

namespace LimfxaiFormal

/-- Reward for following the protocol. -/
def HonestUtility (reward : Int) : Int := reward

/-- Utility from deviation after applying the slashing penalty. -/
def ByzantineUtility (attackGain penalty : Int) : Int :=
  attackGain - penalty

/-- Incentive compatibility condition:
    honest behavior is strictly more profitable. -/
def IncentiveCompatible
    (reward attackGain penalty : Int) : Prop :=
  attackGain < reward + penalty

/-- The incentive condition guarantees honest behavior
    has strictly greater utility. -/
theorem honest_utility_is_higher
    (reward attackGain penalty : Int)
    (h : IncentiveCompatible reward attackGain penalty) :
    ByzantineUtility attackGain penalty <
      HonestUtility reward := by
  dsimp [IncentiveCompatible, ByzantineUtility, HonestUtility] at *
  omega

/-- Equivalent algebraic form of the incentive condition. -/
theorem incentive_condition_iff
    (reward attackGain penalty : Int) :
    attackGain - penalty < reward ↔
      attackGain < reward + penalty := by
  omega

/-- The penalty must exceed the attack gain minus the honest reward. -/
theorem sufficient_slashing_threshold
    (reward attackGain penalty : Int)
    (h : IncentiveCompatible reward attackGain penalty) :
    attackGain - reward < penalty := by
  dsimp [IncentiveCompatible] at h
  omega

/-- Positive security margin under incentive compatibility. -/
def SecurityMargin
    (reward attackGain penalty : Int) : Int :=
  reward + penalty - attackGain

theorem incentive_gives_positive_margin
    (reward attackGain penalty : Int)
    (h : IncentiveCompatible reward attackGain penalty) :
    0 < SecurityMargin reward attackGain penalty := by
  dsimp [IncentiveCompatible, SecurityMargin] at *
  omega

end LimfxaiFormal
