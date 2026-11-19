namespace LimfxaiFormal

/-- Finite players and finite pure strategies. -/
abbrev Player (n : Nat) := Fin n
abbrev Strategy (m : Nat) := Fin m

/-- A strategy profile assigns one strategy to each player. -/
abbrev Profile (n m : Nat) := Player n → Strategy m

/-- Integer-valued utility for each player under a profile. -/
abbrev Payoff (n m : Nat) :=
  Profile n m → Player n → Int

/-- Change one player's strategy while keeping all opponents fixed. -/
def Deviate
    {n m : Nat}
    (profile : Profile n m)
    (player : Player n)
    (strategy : Strategy m) : Profile n m :=
  fun other =>
    if other = player then strategy else profile other

/-- Nash equilibrium: no player can improve their payoff
    through a unilateral strategy change. -/
def IsNash
    {n m : Nat}
    (payoff : Payoff n m)
    (profile : Profile n m) : Prop :=
  ∀ player strategy,
    payoff (Deviate profile player (profile player)) player ≥
    payoff (Deviate profile player strategy) player

/-- A weakly dominant strategy is at least as good as every
    alternative, against every strategy profile of the opponents. -/
def IsDominantStrategy
    {n m : Nat}
    (payoff : Payoff n m)
    (player : Player n)
    (strategy : Strategy m) : Prop :=
  ∀ profile alternative,
    payoff (Deviate profile player strategy) player ≥
    payoff (Deviate profile player alternative) player

/-- If every player selects a weakly dominant strategy,
    the resulting profile is a Nash equilibrium. -/
theorem dominant_profile_is_nash
    {n m : Nat}
    (payoff : Payoff n m)
    (profile : Profile n m)
    (h : ∀ player, IsDominantStrategy payoff player (profile player)) :
    IsNash payoff profile := by
  intro player alternative
  exact h player profile alternative

/-- Strict dominance: the selected strategy gives strictly
    greater payoff than every alternative against every profile. -/
def IsStrictlyDominantStrategy
    {n m : Nat}
    (payoff : Payoff n m)
    (player : Player n)
    (strategy : Strategy m) : Prop :=
  ∀ profile alternative,
    alternative ≠ strategy →
    payoff (Deviate profile player strategy) player >
    payoff (Deviate profile player alternative) player

end LimfxaiFormal
