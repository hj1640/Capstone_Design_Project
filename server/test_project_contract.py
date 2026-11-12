import json
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]

class ReviewContractTests(unittest.TestCase):
    def test_current_user_decisions_and_evidence_limits(self):
        contract=json.loads((ROOT/'docs/project-contract.json').read_text(encoding='utf-8'))
        self.assertEqual(contract['scope']['inputKinds'],{'value':['paper','coupang'],'decision':'D-050'})
        self.assertFalse(contract['scope']['onlineOrdersOnly']['value'])
        policy=contract['personalAverage']
        self.assertEqual((policy['scope'],policy['source'],policy['method']),
                         ('personal','package_label','incremental_arithmetic_mean'))
        self.assertIsNone(policy['statisticalOutlierCutoff'])
        self.assertIsNone(policy['minimumPeople'])
        self.assertFalse(policy['automaticallyReplacesLabelDate'])
        self.assertFalse(policy['productionAuthentication'])
        self.assertFalse(policy['nativeDeviceVerified'])
        self.assertFalse(contract['stage7']['communityPublicationEnabled'])
