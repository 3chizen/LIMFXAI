import LimfxaiFormal.WeightedBFTSafety
import LimfxaiFormal.WeightedVotingPower
import LimfxaiFormal.ConsensusModel

namespace LimfxaiFormal

/-- A validator signs a block at a particular height. -/
def WeightedSigns
    {α : Type}
    (signs : α → ConsensusBlock → Bool)
    (validator : α) (block : ConsensusBlock) : Prop :=
  signs validator block = true

/-- A quorum certificate requires every member of its quorum
    to have signed the certified block. -/
def WeightedCertificate
    {α : Type}
    (signs : α → ConsensusBlock → Bool)
    (quorum : α → Bool)
    (xs : List α)
    (block : ConsensusBlock) : Prop :=
  ∀ validator, validator ∈ xs →
    quorum validator = true →
    WeightedSigns signs validator block

/-- Honest validators do not sign conflicting blocks at one height. -/
def HonestNoDoubleSign
    {α : Type}
    (signs : α → ConsensusBlock → Bool)
    (byzantine : α → Bool) : Prop :=
  ∀ validator first second,
    byzantine validator = false →
    BlocksConflict first second →
    ¬ (WeightedSigns signs validator first ∧
       WeightedSigns signs validator second)

/-- Two conflicting weighted certificates cannot both exist
    when their quorum intersection has positive honest power. -/
theorem weighted_conflicting_certificates_impossible
    {α : Type}
    (weight : α → Nat)
    (signs : α → ConsensusBlock → Bool)
    (byzantine p q : α → Bool)
    (xs : List α)
    (first second : ConsensusBlock)
    (hHonestPower :
      0 < HonestIntersectionPower weight byzantine p q xs)
    (hCertP :
      WeightedCertificate signs p xs first)
    (hCertQ :
      WeightedCertificate signs q xs second)
    (hNoDoubleSign :
      HonestNoDoubleSign signs byzantine)
    (hConflict : BlocksConflict first second) :
    False := by
  obtain ⟨validator, hMem, hIntersection, hWeight⟩ :=
    exists_mem_of_votingPower_pos
      weight (fun v => p v && q v && !(byzantine v))
      xs hHonestPower
  have hSplit := hIntersection
  simp only [Bool.and_eq_true] at hSplit
  have hP : p validator = true := hSplit.1.1
  have hQ : q validator = true := hSplit.1.2
  have hNotByz : (!byzantine validator) = true := hSplit.2
  have hHonest : byzantine validator = false := by
    cases hb : byzantine validator <;> simp [hb] at hNotByz ⊢

  have hFirst := hCertP validator hMem hP
  have hSecond := hCertQ validator hMem hQ
  exact hNoDoubleSign validator first second
    hHonest hConflict ⟨hFirst, hSecond⟩

/-- Weighted BFT safety directly from the global fault bound
    and strict weighted quorum thresholds. -/
theorem weighted_bft_conflicting_certificates_impossible
    {α : Type}
    (weight : α → Nat)
    (signs : α → ConsensusBlock → Bool)
    (byzantine p q : α → Bool)
    (xs : List α)
    (first second : ConsensusBlock)
    (total faulty : Nat)
    (hTotal :
      VotingPower weight (fun _ => true) xs = total)
    (hFaulty :
      VotingPower weight byzantine xs ≤ faulty)
    (hFaultThreshold : 3 * faulty < total)
    (hQuorumP :
      2 * total < 3 * VotingPower weight p xs)
    (hQuorumQ :
      2 * total < 3 * VotingPower weight q xs)
    (hCertP : WeightedCertificate signs p xs first)
    (hCertQ : WeightedCertificate signs q xs second)
    (hNoDoubleSign : HonestNoDoubleSign signs byzantine)
    (hConflict : BlocksConflict first second) :
    False := by
  have hHonestPower :=
    weighted_quorum_intersection_has_honest_power
      weight byzantine p q xs total faulty
      hTotal hFaulty hFaultThreshold hQuorumP hQuorumQ
  exact weighted_conflicting_certificates_impossible
    weight signs byzantine p q xs first second
    hHonestPower hCertP hCertQ hNoDoubleSign hConflict


/-- Concrete four-validator model with non-uniform voting power. -/
inductive WeightedSafetyDemoValidator
  | a | b | c | d
  deriving DecidableEq, Repr

def weightedSafetyDemoValidators : List WeightedSafetyDemoValidator :=
  [.a, .b, .c, .d]

def weightedSafetyDemoWeight : WeightedSafetyDemoValidator → Nat
  | .a => 3
  | .b => 2
  | .c => 2
  | .d => 3

def weightedSafetyDemoByzantine : WeightedSafetyDemoValidator → Bool
  | .a => true
  | _ => false

def weightedSafetyDemoResponsive : WeightedSafetyDemoValidator → Bool
  | .a => false
  | _ => true

def weightedSafetyDemoQuorum : WeightedSafetyDemoValidator → Bool :=
  fun v => !(weightedSafetyDemoByzantine v) &&
    weightedSafetyDemoResponsive v

/-- Liveness constructs a responsive honest sublist with power at least seven. -/
theorem weighted_safety_demo_liveness :
    ∃ selected : List WeightedSafetyDemoValidator,
      selected.Sublist weightedSafetyDemoValidators ∧
      selected.Nodup ∧
      7 ≤ VotingPower weightedSafetyDemoWeight
        (fun _ => true) selected ∧
      ∀ v, v ∈ selected →
        weightedSafetyDemoQuorum v = true := by
  exact weighted_bft_construct_responsive_quorum
    weightedSafetyDemoValidators weightedSafetyDemoWeight
    weightedSafetyDemoByzantine weightedSafetyDemoResponsive
    3 0 7
    (by decide)
    (by decide)
    (by decide)
    (by decide)
    (by decide)

/-- The concrete weighted quorum cannot certify conflicting blocks twice. -/
theorem weighted_safety_demo_conflicting_certificates_impossible
    (signs : WeightedSafetyDemoValidator → ConsensusBlock → Bool)
    (first second : ConsensusBlock)
    (hCertP :
      WeightedCertificate signs weightedSafetyDemoQuorum
        weightedSafetyDemoValidators first)
    (hCertQ :
      WeightedCertificate signs weightedSafetyDemoQuorum
        weightedSafetyDemoValidators second)
    (hNoDoubleSign :
      HonestNoDoubleSign signs weightedSafetyDemoByzantine)
    (hConflict : BlocksConflict first second) : False := by
  exact weighted_bft_conflicting_certificates_impossible
    weightedSafetyDemoWeight signs weightedSafetyDemoByzantine
    weightedSafetyDemoQuorum weightedSafetyDemoQuorum
    weightedSafetyDemoValidators first second 10 3
    (by decide)
    (by decide)
    (by decide)
    (by decide)
    (by decide)
    hCertP hCertQ hNoDoubleSign hConflict

/-- Combined result: responsive quorum construction and weighted BFT safety. -/
theorem weighted_safety_demo_liveness_and_safety :
    (∃ selected : List WeightedSafetyDemoValidator,
      selected.Sublist weightedSafetyDemoValidators ∧
      selected.Nodup ∧
      7 ≤ VotingPower weightedSafetyDemoWeight
        (fun _ => true) selected ∧
      ∀ v, v ∈ selected →
        weightedSafetyDemoQuorum v = true) ∧
    (∀ (signs : WeightedSafetyDemoValidator → ConsensusBlock → Bool)
       (first second : ConsensusBlock),
      WeightedCertificate signs weightedSafetyDemoQuorum
        weightedSafetyDemoValidators first →
      WeightedCertificate signs weightedSafetyDemoQuorum
        weightedSafetyDemoValidators second →
      HonestNoDoubleSign signs weightedSafetyDemoByzantine →
      BlocksConflict first second → False) := by
  constructor
  · exact weighted_safety_demo_liveness
  · intro signs first second hP hQ hHonest hConflict
    exact weighted_safety_demo_conflicting_certificates_impossible
      signs first second hP hQ hHonest hConflict


/-- Exact responsive honest validator set in the safety demo. -/
example :
    List.filter weightedSafetyDemoQuorum
      weightedSafetyDemoValidators = [.b, .c, .d] := by
  decide

/-- The exact responsive honest set has voting power seven. -/
example :
    VotingPower weightedSafetyDemoWeight
      (fun _ => true) [.b, .c, .d] = 7 := by
  decide

/-- The concrete quorum is strictly greater than two thirds. -/
example :
    2 * 10 <
      3 * VotingPower weightedSafetyDemoWeight
        weightedSafetyDemoQuorum weightedSafetyDemoValidators := by
  decide

/-- The concrete Byzantine power is strictly below one third. -/
example :
    3 * VotingPower weightedSafetyDemoWeight
      weightedSafetyDemoByzantine weightedSafetyDemoValidators < 10 := by
  decide


/-- The general weighted bound guarantees at least one unit of honest
voting power in the intersection of the two concrete quorums. -/
example :
    1 ≤ HonestIntersectionPower weightedSafetyDemoWeight
      weightedSafetyDemoByzantine weightedSafetyDemoQuorum
      weightedSafetyDemoQuorum weightedSafetyDemoValidators := by
  have h := weighted_honest_intersection_subtraction_bound
    weightedSafetyDemoWeight weightedSafetyDemoByzantine
    weightedSafetyDemoQuorum weightedSafetyDemoQuorum
    weightedSafetyDemoValidators 10 3 (by decide) (by decide)
  have hp :
      VotingPower weightedSafetyDemoWeight weightedSafetyDemoQuorum
        weightedSafetyDemoValidators = 7 := by
    decide
  rw [hp] at h
  omega

/-- The actual honest intersection in this concrete demo has power seven. -/
example :
    HonestIntersectionPower weightedSafetyDemoWeight
      weightedSafetyDemoByzantine weightedSafetyDemoQuorum
      weightedSafetyDemoQuorum weightedSafetyDemoValidators = 7 := by
  decide

end LimfxaiFormal
