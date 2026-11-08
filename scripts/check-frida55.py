"""Offline Frida5.5 extraction/check from pinned ORIGINAL XLSX, Python stdlib only.
Usage: python scripts/check-frida55.py --inputs ../ [--write]
--write is only for deliberately regenerating the bounded assets. No network/I/O outside inputs/output.
"""
import argparse
from decimal import Decimal, InvalidOperation
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import stat
import xml.etree.ElementTree as ET
import zipfile

IDS = [1,2,3,4,6,12,17,24,30,33,35,50,52,156,272,305,388,480,517,622,754,795,801,914,942,1049,1066,1252,1296,1467,1597,1658,1664,1671,1678,1799,1807,1810,1822,1973]
MAPPING = [
 ('energyKcal',359,'kcal/100 g',1), ('proteinG',317,'g/100g',1),
 ('carbohydrateG',318,'g/100g',1), ('fatG',141,'g/100g',1),
 ('fibreG',168,'g/100g',1), ('ironMg',162,'mg/100g',1),
 ('calciumMg',108,'mg/100g',1), ('magnesiumMg',184,'mg/100g',1),
 ('zincMg',274,'mg/100g',1), ('potassiumMg',165,'mg/100g',1),
 ('sodiumMg',201,'mg/100g',1), ('vitaminDUg',126,'µg/100g',1),
 ('vitaminB12Ug',38,'µg/100g',1), ('folateUg',143,'µg/100g',1),
 ('leucineG',180,'mg/100g',1000)]
XLSX_SHA = '6b1952a35df3c0d4d7b2699ae0a3e377add42b231108309329b40256ef600e5e'
MANIFEST_SHA = '5fdba082738e6180cfba13a1de04499efff5968d996820287049ccfb6ac42706'
NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'

def digest(b): return hashlib.sha256(b).hexdigest()
def safe(n):
 assert n and not n.startswith(('/', '\\')) and not re.match(r'^[A-Za-z]:',n)
 assert '\\' not in n and '..' not in PurePosixPath(n).parts
 return n

def number(raw):
 if raw is None: return None
 assert isinstance(raw,str) and re.fullmatch(r'[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[Ee][+-]?[0-9]+)?',raw), raw
 try: value=Decimal(raw)
 except InvalidOperation: raise AssertionError(raw)
 assert value.is_finite() and value>=0,raw
 return value

def extract(inputs):
 mb=(inputs/'INPUT-MANIFEST.json').read_bytes();assert digest(mb)==MANIFEST_SHA
 manifest=json.loads(mb)
 for n,v in manifest['files'].items():
  b=(inputs/safe(n)).read_bytes();assert len(b)==v['bytes'] and digest(b)==v['sha256'],n
 sm=json.loads((inputs/'input-119-FRIDA-SOURCE-MANIFEST.json').read_bytes())
 article=json.loads((inputs/'input-74-FRIDA-OFFICIAL-ARTICLE.json').read_bytes())
 assert article['id']==29500682 and article['version']==8 and article['doi']=='10.11583/DTU.29500682.v8'
 assert article['license']==sm['license'] and article['license']['name']=='CC BY 4.0'
 official=next(f for f in article['files'] if f['id']==60901603)
 assert official['name']=='Frida_5.5_Dataset.xlsx' and official['size']==12298422 and not official['is_link_only']
 chunks=[]
 for part in sm['workbookOriginalParts']:
  matches=list(inputs.glob('input-*-'+safe(part['name'])));assert len(matches)==1
  b=matches[0].read_bytes();assert len(b)==part['bytes'] and digest(b)==part['sha256'];chunks.append(b)
 original=b''.join(chunks);assert len(original)==12298422 and digest(original)==XLSX_SHA
 assert hashlib.md5(original).hexdigest()==official['computed_md5']==official['supplied_md5']=='b553eed6805e3cd8856663421de0f1fe'
 z=zipfile.ZipFile(io.BytesIO(original));seen=set()
 for info in z.infolist():
  safe(info.filename);assert info.filename not in seen;seen.add(info.filename)
  assert not stat.S_ISLNK(info.external_attr>>16) and not info.flag_bits&1
  assert info.file_size<100000000
 def xml(n):
  b=z.read(n);assert b'<!DOCTYPE' not in b and b'<!ENTITY' not in b
  return b
 strings=[''.join(si.itertext()) for si in ET.fromstring(xml('xl/sharedStrings.xml'))]
 rels={r.get('Id'):'xl/'+safe(r.get('Target')) for r in ET.fromstring(xml('xl/_rels/workbook.xml.rels')) if not r.get('TargetMode')}
 sheets={s.get('name'):rels[s.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')] for s in ET.fromstring(xml('xl/workbook.xml')).find(NS+'sheets')}
 def rows(sheet):
  for _,el in ET.iterparse(io.BytesIO(xml(sheets[sheet])),events=['end']):
   if el.tag==NS+'row':
    values={}
    for c in el:
     assert c.find(NS+'f') is None,'Formula is not raw source data'
     v=c.find(NS+'v');raw=None if v is None else v.text
     assert c.get('t') in (None,'n','s')
     values[re.sub(r'[0-9]','',c.get('r'))]=strings[int(raw)] if c.get('t')=='s' else raw
    yield int(el.get('r')),values
    el.clear()
 params={int(r['E']):r for i,r in rows('Parameter') if i>1}
 foods={int(r['C']):r for i,r in rows('Food') if i>1 and r.get('C')}
 references={int(r['A']):r for i,r in rows('Source') if i>1 and r.get('A')}
 for _,pid,unit,_ in MAPPING: assert params[pid]['C']==unit,(pid,params[pid]['C'])
 wanted={pid for _,pid,_,_ in MAPPING};normalized={}
 for i,r in rows('Data_Normalised'):
  if i>1 and int(r['A']) in IDS and int(r['D']) in wanted:
   key=(int(r['A']),int(r['D']));assert key not in normalized
   number(r['H']);normalized[key]=(i,r)
 wide={};columns={};units={}
 for i,r in rows('Data_Table'):
  if i==3: units=r
  if i==4: columns={int(v):c for c,v in r.items() if c not in ('A','B','C') and v is not None and v.isdigit()}
  if i>4 and r.get('C') and int(r['C']) in IDS: wide[int(r['C'])]=(i,r)
 runtime=[];audit=[];sources={1001,1003};unknown=[];zeros=[]
 for fid in IDS:
  food=foods[fid];wi,wr=wide[fid];assert food['A']==wr['A']
  values={};cells=[];refs=[]
  for key,pid,unit,divisor in MAPPING:
   col=columns[pid];assert units[col]==unit
   entry=normalized.get((fid,pid));raw=entry[1]['H'] if entry else None
   assert number(raw)==number(wr.get(col)),(fid,pid,raw,wr.get(col))
   if entry:
    ni,nr=entry;assert nr['B']==food['A']
    assert nr['M']=='NULL' or re.fullmatch(r'[0-9]+(?:, [0-9]+)*',nr['M']), (fid,pid,repr(nr['M']))
    source_ids=[] if nr['M']=='NULL' else [int(s) for s in nr['M'].split(', ')]
    for sid in source_ids: assert sid in references; sources.add(sid)
    refs.append([pid,nr['M'],nr['N']])
   value=None if raw is None else float(number(raw))/divisor
   values[key]=value
   if entry is None: unknown.append([fid,pid])
   elif value==0: zeros.append([fid,pid])
   cells.append({'nutrient':key,'parameterId':pid,'unit':unit,'divisor':divisor,
    'normalizedRow':entry[0] if entry else None,'rawResVal':raw,
    'source':entry[1]['M'] if entry else None,'sourceFood':entry[1]['N'] if entry else None,
    'wideCell':col+str(wi),'wideRaw':wr.get(col),'value':value})
  assert all(values[k] is not None for k in ('energyKcal','proteinG','carbohydrateG','fatG'))
  runtime.append({'foodId':fid,'name':food['A'],'values':values,'references':refs})
  audit.append({'foodId':fid,'name':food['A'],'foodGroupId':int(food['K']),'foodGroup':food['L'],'cells':cells})
 assert unknown and zeros
 readme=[r for _,r in rows('Readme')]
 provenance={'schema':'entropi-frida55-extraction/v1','doi':'10.11583/DTU.29500682.v8',
  'articleId':29500682,'articleVersion':8,'license':article['license'],
  'officialXlsxFileId':60901603,'officialMD5':official['computed_md5'],'articleCitation':article['citation'],
  'officialArticleSHA256':digest((inputs/'input-74-FRIDA-OFFICIAL-ARTICLE.json').read_bytes()),
  'attribution':readme[6]['A'],'originalXlsx':{'sha256':XLSX_SHA,'bytes':len(original)},
  'basis':'Per 100 g edible portion of the exact named food state; no yield or brand inference.',
  'referenceLimitation':'Average reference data; includes estimated/calculated/borrowed values, not individually measured or exact branded content.',
  'readmeExcerpts':[readme[i]['A'] for i in (3,6,14,16)],
  'selection':IDS,'mapping':MAPPING,'unknownExamples':unknown,'zeroExamples':zeros,
  'sources':{str(s):references[s] for s in sorted(sources)},'foods':audit}
 z.close()
 return runtime,provenance

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--inputs',type=Path,required=True);ap.add_argument('--write',action='store_true');args=ap.parse_args()
 runtime,provenance=extract(args.inputs)
 folder=Path(__file__).resolve().parents[1]/'src/entropi2/kostplan/foedevarer'
 outputs={'frida55.data.mjs':'// Generated by scripts/check-frida55.py from the original XLSX. No inferred values.\nexport const FRIDA_ROWS = '+json.dumps(runtime,ensure_ascii=False,separators=(',',':'))+'\n',
  'frida55.provenance.json':json.dumps(provenance,ensure_ascii=False,indent=2)+'\n'}
 for name,content in outputs.items():
  b=content.encode('utf-8')
  if args.write:(folder/name).write_bytes(b)
  else:assert (folder/name).read_bytes()==b,name+' differs from ORIGINAL XLSX extraction'
  print(name,len(b),digest(b))
 print('Verified',len(runtime)*len(MAPPING),'selected cells against both ORIGINAL sheets; unknown',len(provenance['unknownExamples']),'known zero',len(provenance['zeroExamples']))
if __name__=='__main__':main()
