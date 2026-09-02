import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "python"))

from fit_conveyor import Unfittable, mosfet_threshold_seed_and_bounds


class MosfetThresholdPolicyTest(unittest.TestCase):
    def test_typical_only_cannot_fabricate_f2_dc_interval(self):
        with self.assertRaisesRegex(Unfittable, "requires both minimum and maximum"):
            mosfet_threshold_seed_and_bounds({"threshold_typ": {"value": 1.5}})

    def test_published_non_degenerate_interval_is_used_verbatim(self):
        seed, lower, upper = mosfet_threshold_seed_and_bounds({
            "threshold_min": {"value": 0.8},
            "threshold_typ": {"value": 1.5},
            "threshold_max": {"value": 3.0},
        })
        self.assertEqual((seed, lower, upper), (1.5, 0.8, 3.0))


if __name__ == "__main__":
    unittest.main()
