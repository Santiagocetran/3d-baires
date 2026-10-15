"""Conservative parsing and matching; independent of geospatial dependencies."""
import math
import re

def parse_height(value):
    if value is None or str(value).strip().lower() in ('', 'null', 'none', 'nan', 's/d'):
        return None, 'missing'
    if isinstance(value, bool):
        return None, 'unparseable'
    text = str(value).strip()
    # Decimal comma is accepted; d is NOT assumed to mean a decimal point.
    if not re.fullmatch(r'[+-]?\d+(?:[.,]\d+)?', text):
        return None, 'unparseable'
    number = float(text.replace(',', '.'))
    if not math.isfinite(number):
        return None, 'unparseable'
    if number < 0:
        return number, 'negative'
    if number == 0:
        return number, 'zero'
    if number > 350:
        return number, 'implausible'
    return number, 'valid'

def smp_key(value):
    # Preserve leading zeros and letter case: cadastral codes are identities.
    return str(value).strip() if value is not None else ''

def match_address(smp, parcels, addresses):
    key = smp_key(smp)
    count = parcels.get(key, 0) if key else 0
    values = sorted(addresses.get(key, set())) if key else []
    if count == 0:
        return 'parcel_unmatched', []
    if count > 1:
        return 'parcel_ambiguous', values
    if not values:
        return 'address_missing', []
    return ('parcel_address_single' if len(values) == 1 else 'parcel_address_multiple'), values

def canonical_smp(value):
    """Standardize numeric section width only; keep the original identifier elsewhere."""
    key = smp_key(value)
    key = '-'.join(part.strip() for part in key.split('-'))
    match = re.fullmatch(r'(\d{1,3})-(.+)-(.+)', key)
    return f'{int(match[1]):03d}-{match[2]}-{match[3]}' if match else key

def frontage_numbers(value):
    """Observed dot-separated door list; retain suffixes, reject unknown tokens."""
    return sorted(set(token for token in str(value or '').strip().split('.')
                      if re.fullmatch(r'[0-9]+[A-Za-z]?', token)))
