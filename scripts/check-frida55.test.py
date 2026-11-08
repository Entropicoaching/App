"""Narrow hermetic validation tests; no dataset or network is synthesized as truth."""
import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('frida',Path(__file__).with_name('check-frida55.py'))
frida=importlib.util.module_from_spec(spec)
spec.loader.exec_module(frida)

class Validation(unittest.TestCase):
 def test_unknown_and_exact_zero_are_distinct(self):
  self.assertIsNone(frida.number(None))
  self.assertEqual(frida.number('0'),0)
  self.assertEqual(str(frida.number('0.12345678901234567')),'0.12345678901234567')
 def test_malformed_negative_and_nonfinite_are_rejected(self):
  for raw in ['','NULL','NaN','Infinity','-1','1,2',' 1','1mg','1/2',[],True]:
   with self.subTest(raw=raw),self.assertRaises(AssertionError):frida.number(raw)
 def test_archive_paths_cannot_escape_reconstruction(self):
  for name in ['../x','a/../x','/x','C:/x','C:\\x','a\\b','']:
   with self.subTest(name=name),self.assertRaises(AssertionError):frida.safe(name)
  self.assertEqual(frida.safe('xl/worksheets/sheet3.xml'),'xl/worksheets/sheet3.xml')
 def test_labelling_mapping_and_leucine_units_are_explicit(self):
  self.assertEqual([(key,pid,divisor) for key,pid,_,divisor in frida.MAPPING][:3],
   [('energyKcal',359,1),('proteinG',317,1),('carbohydrateG',318,1)])
  self.assertEqual(frida.MAPPING[-1],('leucineG',180,'mg/100g',1000))

if __name__=='__main__':unittest.main()
