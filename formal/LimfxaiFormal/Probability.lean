import LimfxaiFormal.Existence

namespace LimfxaiFormal

/-- A normalized discrete probability represented by a fraction. -/
structure Probability where
  numerator : Nat
  denominator : Nat
  denominator_pos : 0 < denominator
  numerator_le_denominator : numerator ≤ denominator

/-- The complement of a probability. -/
def Probability.complement (p : Probability) : Probability where
  numerator := p.denominator - p.numerator
  denominator := p.denominator
  denominator_pos := p.denominator_pos
  numerator_le_denominator := by omega

/-- Every probability has a nonnegative numerator. -/
theorem probability_nonnegative (p : Probability) :
    0 ≤ p.numerator := by
  omega

/-- Every normalized probability is at most one. -/
theorem probability_at_most_one (p : Probability) :
    p.numerator ≤ p.denominator := by
  exact p.numerator_le_denominator

/-- An event and its complement have numerators summing to the denominator. -/
theorem probability_complement_sum (p : Probability) :
    p.numerator + p.complement.numerator = p.denominator := by
  have h := p.numerator_le_denominator
  simp [Probability.complement]
  omega

/-- The complement of the complement restores the original numerator. -/
theorem complement_involutive (p : Probability) :
    p.complement.complement.numerator = p.numerator := by
  have h := p.numerator_le_denominator
  simp [Probability.complement]
  omega

/-- A finite probability space with bounded event masses. -/
structure FiniteProbabilitySpace (Event : Type) where
  totalMass : Nat
  totalMass_pos : 0 < totalMass
  mass : Event → Nat
  mass_le_total : ∀ event, mass event ≤ totalMass

/-- Normalize an event's mass by the total mass. -/
def FiniteProbabilitySpace.probabilityOf
    {Event : Type}
    (space : FiniteProbabilitySpace Event)
    (event : Event) : Probability where
  numerator := space.mass event
  denominator := space.totalMass
  denominator_pos := space.totalMass_pos
  numerator_le_denominator := space.mass_le_total event

/-- Every event in a finite probability space has valid probability bounds. -/
theorem event_probability_bounded
    {Event : Type}
    (space : FiniteProbabilitySpace Event)
    (event : Event) :
    (space.probabilityOf event).numerator ≤
      (space.probabilityOf event).denominator := by
  exact (space.probabilityOf event).numerator_le_denominator

/-- Event mass plus complementary mass equals total mass. -/
def ComplementaryMass
    (total eventMass : Nat) : Nat :=
  total - eventMass

theorem event_and_complement_mass_sum
    (total eventMass : Nat)
    (h : eventMass ≤ total) :
    eventMass + ComplementaryMass total eventMass = total := by
  simp [ComplementaryMass]
  omega

/-- Total weight of outcomes belonging to an event. -/
def EventWeight {α : Type} (event : α → Prop)
    [DecidablePred event] : List (α × Nat) → Nat
  | [] => 0
  | (outcome, weight) :: rest =>
      (if event outcome then weight else 0) +
        EventWeight event rest

/-- Total weight of all outcomes. -/
def TotalWeight {α : Type} : List (α × Nat) → Nat
  | [] => 0
  | (_, weight) :: rest => weight + TotalWeight rest

/-- An event's weight cannot exceed the total weight. -/
theorem event_weight_le_total
    {α : Type} (event : α → Prop) [DecidablePred event]
    (samples : List (α × Nat)) :
    EventWeight event samples ≤ TotalWeight samples := by
  induction samples with
  | nil => simp [EventWeight, TotalWeight]
  | cons sample rest ih =>
      rcases sample with ⟨x, w⟩
      simp only [EventWeight, TotalWeight]
      split <;> omega

/-- Disjoint events have additive combined weight. -/
theorem disjoint_event_weights_add
    {α : Type}
    (p q : α → Prop)
    [DecidablePred p] [DecidablePred q]
    (hdisjoint : ∀ x, p x → q x → False)
    (samples : List (α × Nat)) :
    EventWeight (fun x => p x ∨ q x) samples =
      EventWeight p samples + EventWeight q samples := by
  induction samples with
  | nil => rfl
  | cons sample rest ih =>
      rcases sample with ⟨x, w⟩
      simp only [EventWeight]
      have hhead :
          (if p x ∨ q x then w else 0) =
            (if p x then w else 0) +
              (if q x then w else 0) := by
        by_cases hp : p x
        · by_cases hq : q x
          · exact False.elim (hdisjoint x hp hq)
          · simp [hp, hq]
        · by_cases hq : q x
          · simp [hp, hq]
          · simp [hp, hq]
      rw [hhead, ih]
      omega

end LimfxaiFormal
