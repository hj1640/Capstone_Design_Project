import unittest
from stage4_compare import metrics, structural_policy


class MetricTests(unittest.TestCase):
    def test_unknown_and_ambiguous_do_not_inflate_known_accuracy(self):
        rows = [dict(kind='known',expectedProductIds=['p'],expectedFoodIds=['f'],
                     ranked=[dict(productId='p',foodId='f')]),
                dict(kind='unknown',expectedProductIds=[],expectedFoodIds=[],ranked=[dict(productId='p',foodId='f')]),
                dict(kind='ambiguous',expectedProductIds=['p'],expectedFoodIds=['f'],ranked=[dict(productId='p',foodId='f')])]
        self.assertEqual(metrics(rows,'ranked'),dict(known_count=1,product_top1=1,product_top3=1,food_top1=1))

    def test_product_error_can_still_have_correct_food(self):
        row = dict(kind='known',expectedProductIds=['p'],expectedFoodIds=['f'],
            ranked=[dict(productId='other',foodId='f'),dict(productId='p',foodId='f')])
        m = metrics([row],'ranked')
        self.assertEqual((m['product_top1'],m['product_top3'],m['food_top1']),(0,1,1))

    def test_empty_metrics_are_unknown(self):
        self.assertIsNone(metrics([],'ranked')['food_top1'])

    def test_unknown_automatic_suggestion_counts_as_error(self):
        row = dict(kind='unknown',expectedFoodIds=[],stage3=dict(selectedFoodId='f',resolution='food_only'))
        self.assertEqual(structural_policy([row])['wrong_food_suggestions'],1)


if __name__ == '__main__':
    unittest.main()
