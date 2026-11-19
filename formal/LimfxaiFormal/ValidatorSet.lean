import LimfxaiFormal.StateMachine

namespace LimfxaiFormal

/-- A validator set is represented by a list with no duplicate members. -/
structure ValidatorSet (α : Type) where
  members : List α
  nodup : members.Nodup

/-- A transition explicitly records additions, removals, and the new membership relation. -/
structure ValidatorSetTransition (α : Type) where
  oldSet : ValidatorSet α
  newSet : ValidatorSet α
  added : List α
  removed : List α
  added_nodup : added.Nodup
  removed_nodup : removed.Nodup
  added_disjoint_old :
    ∀ v, v ∈ added → v ∉ oldSet.members
  removed_subset_old :
    ∀ v, v ∈ removed → v ∈ oldSet.members
  added_disjoint_removed :
    ∀ v, v ∈ added → v ∉ removed
  membership :
    ∀ v, v ∈ newSet.members ↔
      (v ∈ oldSet.members ∧ v ∉ removed) ∨ v ∈ added

/-- Validator membership is unique in every well-formed validator set. -/
theorem validatorSet_has_no_duplicates
    {α : Type} (s : ValidatorSet α) :
    s.members.Nodup := by
  exact s.nodup

/-- Every validator retained from the old set remains in the new set. -/
theorem transition_keeps_unremoved
    {α : Type} (t : ValidatorSetTransition α) (v : α)
    (hOld : v ∈ t.oldSet.members)
    (hNotRemoved : v ∉ t.removed) :
    v ∈ t.newSet.members := by
  apply (t.membership v).2
  exact Or.inl ⟨hOld, hNotRemoved⟩

/-- Every explicitly added validator belongs to the new set. -/
theorem transition_adds_validator
    {α : Type} (t : ValidatorSetTransition α) (v : α)
    (hAdded : v ∈ t.added) :
    v ∈ t.newSet.members := by
  apply (t.membership v).2
  exact Or.inr hAdded

/-- A removed validator cannot remain in the new set. -/
theorem transition_removes_validator
    {α : Type} (t : ValidatorSetTransition α) (v : α)
    (hRemoved : v ∈ t.removed) :
    v ∉ t.newSet.members := by
  intro hNew
  have hMembership := (t.membership v).1 hNew
  rcases hMembership with ⟨_, hNotRemoved⟩ | hAdded
  · exact hNotRemoved hRemoved
  · exact t.added_disjoint_removed v hAdded hRemoved

/-- Every added validator was absent from the old set. -/
theorem transition_added_was_new
    {α : Type} (t : ValidatorSetTransition α) (v : α)
    (hAdded : v ∈ t.added) :
    v ∉ t.oldSet.members := by
  exact t.added_disjoint_old v hAdded

/-- Every removed validator belonged to the old set. -/
theorem transition_removed_was_active
    {α : Type} (t : ValidatorSetTransition α) (v : α)
    (hRemoved : v ∈ t.removed) :
    v ∈ t.oldSet.members := by
  exact t.removed_subset_old v hRemoved

end LimfxaiFormal
