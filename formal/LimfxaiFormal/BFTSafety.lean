import LimfxaiFormal.BFTThreshold
import LimfxaiFormal.ConsensusModel

namespace LimfxaiFormal

/--
BFT safety at one height:
two conflicting quorum certificates cannot both exist
under the classic population and quorum thresholds,
a global Byzantine bound, and honest no-double-signing.
Rounds may differ.
-/
theorem classic_bft_conflicting_certificates_impossible
    {Validator : Type}
    (s : ValidatorSet Validator)
    (quorumA quorumB byzantine : Validator → Bool)
    (signs : Validator → ConsensusBlock → Prop)
    (blockA blockB : ConsensusBlock)
    (f : Nat)
    (hPopulation : BFTPopulation s.members.length f)
    (hQuorumA :
      2 * f + 1 ≤ ValidatorQuorumSize s quorumA)
    (hQuorumB :
      2 * f + 1 ≤ ValidatorQuorumSize s quorumB)
    (hGlobalByzantine :
      List.countP byzantine s.members ≤ f)
    (hCertificateA :
      ∀ v, quorumA v = true → SignsBlock signs v blockA)
    (hCertificateB :
      ∀ v, quorumB v = true → SignsBlock signs v blockB)
    (hNoDoubleSign :
      ∀ v, byzantine v = false →
        blockA.height = blockB.height →
        blockA.blockId ≠ blockB.blockId →
        ¬ (SignsBlock signs v blockA ∧
           SignsBlock signs v blockB))
    (hConflict : BlocksConflict blockA blockB) :
    False := by
  obtain ⟨v, _, hA, hB, hHonest⟩ :=
    classic_bft_honest_intersection_global_fault_bound
      s quorumA quorumB byzantine f
      hPopulation hQuorumA hQuorumB hGlobalByzantine
  have hSignA := hCertificateA v hA
  have hSignB := hCertificateB v hB
  exact hNoDoubleSign v hHonest hConflict.1 hConflict.2
    ⟨hSignA, hSignB⟩

end LimfxaiFormal
