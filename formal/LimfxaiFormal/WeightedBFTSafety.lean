import LimfxaiFormal.WeightedIntersection

namespace LimfxaiFormal

/-- Honest voting power inside the intersection of two groups. -/
def HonestIntersectionPower {α : Type}
    (weight : α → Nat) (byzantine p q : α → Bool)
    (xs : List α) : Nat :=
  VotingPower weight
    (fun v => p v && q v && !(byzantine v)) xs

/-- The Byzantine voting power in an intersection cannot exceed
    the total Byzantine voting power. -/
theorem intersection_byzantine_power_le
    {α : Type} (weight : α → Nat)
    (byzantine p q : α → Bool) (xs : List α) :
    VotingPower weight
      (fun v => p v && q v && byzantine v) xs ≤
    VotingPower weight byzantine xs := by
  induction xs with
  | nil => simp [VotingPower]
  | cons v rest ih =>
      simp only [VotingPower]
      by_cases hb : byzantine v = true
      · by_cases hp : p v = true <;>
          by_cases hq : q v = true <;>
          simp [hb, hp, hq] at ih ⊢ <;> omega
      · simp [hb] at ih ⊢
        omega

/-- The voting power of an intersection splits into Byzantine
    and honest voting power. -/
theorem votingPower_intersection_partition
    {α : Type} (weight : α → Nat)
    (byzantine p q : α → Bool) (xs : List α) :
    VotingPower weight
        (fun v => p v && q v && byzantine v) xs +
      VotingPower weight
        (fun v => p v && q v && !(byzantine v)) xs =
      VotingPower weight (fun v => p v && q v) xs := by
  induction xs with
  | nil => simp [VotingPower]
  | cons v rest ih =>
      by_cases hp : p v = true <;>
        by_cases hq : q v = true <;>
        by_cases hb : byzantine v = true <;>
        simp [VotingPower, hp, hq, hb] at ih ⊢ <;> omega

/-- Two strict two-thirds quorums have honest voting power
    in their intersection when Byzantine power is below one third. -/
theorem weighted_quorum_intersection_has_honest_power
    {α : Type} (weight : α → Nat)
    (byzantine p q : α → Bool) (xs : List α)
    (total faulty : Nat)
    (hTotal :
      VotingPower weight (fun _ => true) xs = total)
    (hFaulty :
      VotingPower weight byzantine xs ≤ faulty)
    (hFaultThreshold : 3 * faulty < total)
    (hQuorumP :
      2 * total <
        3 * VotingPower weight p xs)
    (hQuorumQ :
      2 * total <
        3 * VotingPower weight q xs) :
    0 < HonestIntersectionPower weight byzantine p q xs := by
  have hIntersection :=
    intersection_power_lower_bound weight p q xs
  have hByzIntersection :=
    intersection_byzantine_power_le
      weight byzantine p q xs
  have hPositive :
      faulty <
        IntersectionPower weight p q xs := by
    unfold IntersectionPower at hIntersection ⊢
    omega
  have hByzInIntersection :
      VotingPower weight
        (fun v => p v && q v && byzantine v) xs
        ≤ faulty :=
    Nat.le_trans hByzIntersection hFaulty
  have hPartition :=
    votingPower_intersection_partition
      weight byzantine p q xs
  unfold HonestIntersectionPower
  unfold IntersectionPower at hPositive
  omega


/-- Strictly more than two thirds is equivalent to exceeding
    the integer quotient floor(2 * total / 3). -/
theorem strict_two_thirds_iff_nat_threshold
    (total quorum : Nat) :
    2 * total < 3 * quorum ↔
      2 * total / 3 < quorum := by
  omega

/-- For total voting power ten, the minimum strict two-thirds
    quorum is seven. -/
theorem minimum_quorum_for_ten :
    ∀ quorum : Nat,
      (2 * 10 < 3 * quorum) ↔ 7 ≤ quorum := by
  intro quorum
  omega

/-- Six voting power is insufficient for a strict two-thirds
    quorum when total power is ten. -/
example : ¬ (2 * 10 < 3 * 6) := by
  decide

/-- Seven voting power is sufficient for a strict two-thirds
    quorum when total power is ten. -/
example : 2 * 10 < 3 * 7 := by
  decide


/-- Integer quorum thresholds imply the strict two-thirds condition. -/
theorem integer_threshold_implies_strict_two_thirds
    (total quorum : Nat)
    (hThreshold : 2 * total / 3 < quorum) :
    2 * total < 3 * quorum := by
  omega

/-- Weighted BFT safety using integer quorum thresholds. -/
theorem weighted_bft_safety_integer_threshold
    {α : Type}
    (weight : α → Nat)
    (byzantine p q : α → Bool)
    (xs : List α)
    (total faulty : Nat)
    (hTotal :
      VotingPower weight (fun _ => true) xs = total)
    (hFaulty :
      VotingPower weight byzantine xs ≤ faulty)
    (hFaultThreshold : 3 * faulty < total)
    (hQuorumP :
      2 * total / 3 <
        VotingPower weight p xs)
    (hQuorumQ :
      2 * total / 3 <
        VotingPower weight q xs) :
    0 < HonestIntersectionPower weight byzantine p q xs := by
  apply weighted_quorum_intersection_has_honest_power
    weight byzantine p q xs total faulty
  · exact hTotal
  · exact hFaulty
  · exact hFaultThreshold
  · exact integer_threshold_implies_strict_two_thirds
      total (VotingPower weight p xs) hQuorumP
  · exact integer_threshold_implies_strict_two_thirds
      total (VotingPower weight q xs) hQuorumQ


/-- Integer Byzantine fault bound equivalent to strictly less than one third. -/
theorem integer_fault_bound_iff_strict_one_third
    (total faulty : Nat)
    (hTotalPos : 0 < total) :
    3 * faulty < total ↔ faulty ≤ (total - 1) / 3 := by
  omega

/-- Weighted BFT safety using integer quorum and Byzantine thresholds. -/
theorem weighted_bft_safety_integer_bounds
    {α : Type}
    (weight : α → Nat)
    (byzantine p q : α → Bool)
    (xs : List α)
    (total faulty : Nat)
    (hTotal : VotingPower weight (fun _ => true) xs = total)
    (hTotalPos : 0 < total)
    (hFaulty : VotingPower weight byzantine xs ≤ faulty)
    (hFaultBound : faulty ≤ (total - 1) / 3)
    (hQuorumP :
      2 * total / 3 < VotingPower weight p xs)
    (hQuorumQ :
      2 * total / 3 < VotingPower weight q xs) :
    0 < HonestIntersectionPower weight byzantine p q xs := by
  apply weighted_bft_safety_integer_threshold
    weight byzantine p q xs total faulty
  · exact hTotal
  · exact hFaulty
  · exact (integer_fault_bound_iff_strict_one_third
      total faulty hTotalPos).2 hFaultBound
  · exact hQuorumP
  · exact hQuorumQ


/-- A quorum meets the strict two-thirds threshold
    exactly when it reaches floor(2T/3) + 1. -/
theorem quorum_floor_threshold_iff
    (total quorum : Nat) :
    2 * total / 3 < quorum ↔
      2 * total / 3 + 1 ≤ quorum := by
  omega

/-- Weighted BFT safety with directly usable floor-based thresholds. -/
theorem weighted_bft_safety_floor_thresholds
    {α : Type}
    (weight : α → Nat)
    (byzantine p q : α → Bool)
    (xs : List α)
    (total faulty : Nat)
    (hTotal : VotingPower weight (fun _ => true) xs = total)
    (hTotalPos : 0 < total)
    (hFaulty : VotingPower weight byzantine xs ≤ faulty)
    (hFaultBound : faulty ≤ (total - 1) / 3)
    (hQuorumP :
      2 * total / 3 + 1 ≤ VotingPower weight p xs)
    (hQuorumQ :
      2 * total / 3 + 1 ≤ VotingPower weight q xs) :
    0 < HonestIntersectionPower weight byzantine p q xs := by
  apply weighted_bft_safety_integer_bounds
    weight byzantine p q xs total faulty
  · exact hTotal
  · exact hTotalPos
  · exact hFaulty
  · exact hFaultBound
  · exact (quorum_floor_threshold_iff
      total (VotingPower weight p xs)).2 hQuorumP
  · exact (quorum_floor_threshold_iff
      total (VotingPower weight q xs)).2 hQuorumQ


/-- Quantitative lower bound for honest voting power in a quorum intersection. -/
theorem weighted_honest_intersection_lower_bound
    {α : Type}
    (weight : α → Nat)
    (byzantine p q : α → Bool)
    (xs : List α)
    (total faulty : Nat)
    (hTotal :
      VotingPower weight (fun _ => true) xs = total)
    (hFaulty :
      VotingPower weight byzantine xs ≤ faulty) :
    VotingPower weight p xs + VotingPower weight q xs ≤
      total + faulty +
        HonestIntersectionPower weight byzantine p q xs := by
  have hIntersection :=
    intersection_power_lower_bound weight p q xs
  have hByzantine :=
    intersection_byzantine_power_le weight byzantine p q xs
  have hPartition :=
    votingPower_intersection_partition weight byzantine p q xs
  unfold IntersectionPower at hIntersection
  unfold HonestIntersectionPower
  omega


/-- Strict two-thirds quorums and a strict one-third fault bound
    guarantee at least one unit of honest intersection power. -/
theorem weighted_bft_honest_intersection_minimum_one
    {α : Type}
    (weight : α → Nat)
    (byzantine p q : α → Bool)
    (xs : List α)
    (total faulty : Nat)
    (hTotal :
      VotingPower weight (fun _ => true) xs = total)
    (hTotalPos : 0 < total)
    (hFaulty :
      VotingPower weight byzantine xs ≤ faulty)
    (hFaultBound : faulty ≤ (total - 1) / 3)
    (hQuorumP :
      2 * total / 3 + 1 ≤ VotingPower weight p xs)
    (hQuorumQ :
      2 * total / 3 + 1 ≤ VotingPower weight q xs) :
    1 ≤ HonestIntersectionPower weight byzantine p q xs := by
  have hLower :=
    weighted_honest_intersection_lower_bound
      weight byzantine p q xs total faulty hTotal hFaulty
  have hFaultStrict :=
    (integer_fault_bound_iff_strict_one_third
      total faulty hTotalPos).2 hFaultBound
  have hPStrict :=
    (quorum_floor_threshold_iff
      total (VotingPower weight p xs)).2 hQuorumP
  have hQStrict :=
    (quorum_floor_threshold_iff
      total (VotingPower weight q xs)).2 hQuorumQ
  unfold HonestIntersectionPower at hLower ⊢
  omega


/-- Explicit natural-number lower bound for honest intersection power. -/
theorem weighted_honest_intersection_subtraction_bound
    {α : Type}
    (weight : α → Nat)
    (byzantine p q : α → Bool)
    (xs : List α)
    (total faulty : Nat)
    (hTotal :
      VotingPower weight (fun _ => true) xs = total)
    (hFaulty :
      VotingPower weight byzantine xs ≤ faulty) :
    VotingPower weight p xs + VotingPower weight q xs -
      (total + faulty) ≤
        HonestIntersectionPower weight byzantine p q xs := by
  have hLower :=
    weighted_honest_intersection_lower_bound
      weight byzantine p q xs total faulty hTotal hFaulty
  omega

end LimfxaiFormal
