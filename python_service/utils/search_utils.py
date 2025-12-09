"""
Intelligent Search Utilities

Provides fuzzy matching, stemming, pluralization, and word similarity
for more intelligent search capabilities across the application.

This module handles:
- Pluralization/singularization (cats <-> cat, categories <-> category)
- Word stemming (running -> run, swimming -> swim)
- Fuzzy/approximate matching for typos
- Word similarity scoring
"""

import re
from typing import List, Set, Tuple
from difflib import SequenceMatcher
from functools import lru_cache


# Common typos mapping typo -> correct word
COMMON_TYPOS = {
    'imge': 'image',
    'prodcut': 'product',
    'picutre': 'picture',
    'photot': 'photo',
    'vide': 'video',
    'vidoe': 'video',
    'galery': 'gallery',
    'galley': 'gallery',
    'collecition': 'collection',
    'colection': 'collection',
    'porfolio': 'portfolio',
    'potfolio': 'portfolio',
}

# Common irregular plural forms
IRREGULAR_PLURALS = {
    # Singular -> Plural
    'child': 'children',
    'person': 'people',
    'man': 'men',
    'woman': 'women',
    'foot': 'feet',
    'tooth': 'teeth',
    'goose': 'geese',
    'mouse': 'mice',
    'ox': 'oxen',
    'cactus': 'cacti',
    'focus': 'foci',
    'fungus': 'fungi',
    'nucleus': 'nuclei',
    'radius': 'radii',
    'analysis': 'analyses',
    'basis': 'bases',
    'crisis': 'crises',
    'diagnosis': 'diagnoses',
    'thesis': 'theses',
    'criterion': 'criteria',
    'phenomenon': 'phenomena',
    'datum': 'data',
    'medium': 'media',
    'stadium': 'stadia',
    'antenna': 'antennae',
    'formula': 'formulae',
    'vertebra': 'vertebrae',
    'appendix': 'appendices',
    'index': 'indices',
    'matrix': 'matrices',
}

# Reverse mapping for plural -> singular
IRREGULAR_SINGULARS = {v: k for k, v in IRREGULAR_PLURALS.items()}

# Common synonyms for better semantic matching
SYNONYMS = {
    'plane': ['airplane', 'aircraft', 'jet'],
    'airplane': ['plane', 'aircraft', 'jet'],
    'aircraft': ['plane', 'airplane', 'jet'],
    'jet': ['plane', 'airplane', 'aircraft'],
    'car': ['automobile', 'vehicle', 'auto'],
    'automobile': ['car', 'vehicle', 'auto'],
    'vehicle': ['car', 'automobile', 'auto'],
    'auto': ['car', 'automobile', 'vehicle'],
    'boat': ['ship', 'vessel', 'watercraft'],
    'ship': ['boat', 'vessel', 'watercraft'],
    'vessel': ['boat', 'ship', 'watercraft'],
    'watercraft': ['boat', 'ship', 'vessel'],
}

# Common word suffixes for stemming
SUFFIXES = [
    ('ational', 'ate'),
    ('tional', 'tion'),
    ('enci', 'ence'),
    ('anci', 'ance'),
    ('izer', 'ize'),
    ('isation', 'ise'),
    ('ization', 'ize'),
    ('ation', 'ate'),
    ('ator', 'ate'),
    ('alism', 'al'),
    ('iveness', 'ive'),
    ('fulness', 'ful'),
    ('ousness', 'ous'),
    ('aliti', 'al'),
    ('iviti', 'ive'),
    ('biliti', 'ble'),
    ('ement', ''),
    ('ment', ''),
    ('ness', ''),
    ('ling', ''),
    ('ally', ''),
    ('ful', ''),
    ('less', ''),
    ('ing', ''),
    ('ed', ''),
    ('er', ''),
    ('es', ''),
    ('ly', ''),
    ('s', ''),
]


def get_plural(word: str) -> str:
    """
    Get the plural form of a word.

    Args:
        word: Singular word

    Returns:
        Plural form of the word
    """
    word_lower = word.lower()

    # Check irregular plurals first
    if word_lower in IRREGULAR_PLURALS:
        return IRREGULAR_PLURALS[word_lower]

    # Apply standard pluralization rules
    if word_lower.endswith('y') and len(word_lower) > 1 and word_lower[-2] not in 'aeiou':
        return word_lower[:-1] + 'ies'
    elif word_lower.endswith(('s', 'x', 'z', 'ch', 'sh')):
        return word_lower + 'es'
    elif word_lower.endswith('f'):
        return word_lower[:-1] + 'ves'
    elif word_lower.endswith('fe'):
        return word_lower[:-2] + 'ves'
    else:
        return word_lower + 's'


def get_singular(word: str) -> str:
    """
    Get the singular form of a word.

    Args:
        word: Plural word

    Returns:
        Singular form of the word
    """
    word_lower = word.lower()

    # Check irregular singulars first
    if word_lower in IRREGULAR_SINGULARS:
        return IRREGULAR_SINGULARS[word_lower]

    # Apply standard singularization rules
    if word_lower.endswith('ies') and len(word_lower) > 3:
        return word_lower[:-3] + 'y'
    elif word_lower.endswith('ves'):
        # Could be -f or -fe
        potential_f = word_lower[:-3] + 'f'
        potential_fe = word_lower[:-3] + 'fe'
        return potential_f  # Default to -f ending
    elif word_lower.endswith('es') and len(word_lower) > 2:
        # Check if base word ends in s, x, z, ch, sh
        base = word_lower[:-2]
        if base.endswith(('s', 'x', 'z', 'ch', 'sh')):
            return base
        elif word_lower.endswith('sses') or word_lower.endswith('xes') or word_lower.endswith('zes'):
            return word_lower[:-2]
        elif word_lower.endswith('ches') or word_lower.endswith('shes'):
            return word_lower[:-2]
        else:
            # Try removing just 's' first
            return word_lower[:-1] if word_lower.endswith('s') else word_lower[:-2]
    elif word_lower.endswith('s') and len(word_lower) > 1:
        return word_lower[:-1]

    return word_lower


@lru_cache(maxsize=500)  # Cache stemmed words
def simple_stem(word: str) -> str:
    """
    Apply simple stemming to reduce a word to its root form.

    This is a lightweight stemmer that handles common English suffixes
    without requiring external dependencies like NLTK.

    Args:
        word: Word to stem

    Returns:
        Stemmed word
    """
    word_lower = word.lower()

    # Don't stem very short words
    if len(word_lower) <= 3:
        return word_lower

    # Try to remove suffixes in order of length (longest first)
    for suffix, replacement in SUFFIXES:
        if word_lower.endswith(suffix) and len(word_lower) > len(suffix) + 2:
            return word_lower[:-len(suffix)] + replacement

    return word_lower


@lru_cache(maxsize=1000)  # Cache frequently used word variants
def get_word_variants(word: str) -> Set[str]:
    """
    Generate variants of a word including:
    - Original word
    - Singular/plural forms
    - Stemmed form

    Args:
        word: Input word

    Returns:
        Set of word variants
    """
    variants = set()
    word_lower = word.lower()

    # Add original
    variants.add(word_lower)

    # Add singular and plural forms
    singular = get_singular(word_lower)
    plural = get_plural(word_lower)
    variants.add(singular)
    variants.add(plural)

    # Add stemmed forms
    variants.add(simple_stem(word_lower))
    variants.add(simple_stem(singular))

    # Add synonyms (check both original word and its singular form)
    words_to_check = [word_lower, singular]
    for check_word in words_to_check:
        if check_word in SYNONYMS:
            for synonym in SYNONYMS[check_word]:
                variants.add(synonym.lower())
                # Also add plural/singular forms of synonyms
                variants.add(get_singular(synonym.lower()))
                variants.add(get_plural(synonym.lower()))

    return variants


def fuzzy_ratio(s1: str, s2: str) -> float:
    """
    Calculate fuzzy match ratio between two strings.

    Args:
        s1: First string
        s2: Second string

    Returns:
        Similarity ratio between 0 and 1
    """
    return SequenceMatcher(None, s1.lower(), s2.lower()).ratio()


def is_fuzzy_match(query: str, target: str, threshold: float = 0.8) -> bool:
    """
    Check if query fuzzy-matches target with given threshold.

    Args:
        query: Search query
        target: Target string to match against
        threshold: Minimum similarity ratio (0-1)

    Returns:
        True if fuzzy match exceeds threshold
    """
    return fuzzy_ratio(query, target) >= threshold


def tokenize(text: str) -> List[str]:
    """
    Split text into word tokens, removing punctuation.

    Args:
        text: Input text

    Returns:
        List of word tokens
    """
    # Remove punctuation and split on whitespace
    return re.findall(r'\b\w+\b', text.lower())


def intelligent_match(query: str, text: str, fuzzy_threshold: float = 0.8) -> Tuple[bool, float]:
    """
    Perform intelligent matching between a query and text.

    This checks for:
    1. Exact substring match
    2. Word variant match (singular/plural/stem)
    3. Fuzzy match for typos (only for legitimate typo patterns)

    Args:
        query: Search query
        text: Text to search in
        fuzzy_threshold: Minimum ratio for fuzzy matching (should be 0.9+ for strict matching)

    Returns:
        Tuple of (is_match, confidence_score)
    """
    if not query or not text:
        return (False, 0.0)

    query_lower = query.lower()
    text_lower = text.lower()

    # 1. Check exact substring match (highest confidence)
    if query_lower in text_lower:
        return (True, 1.0)

    # Tokenize query into words
    query_words = tokenize(query)
    text_words = tokenize(text)
    text_words_set = set(text_words)

    if not query_words:
        return (False, 0.0)

    matched_words = 0
    total_confidence = 0.0

    for qword in query_words:
        # Generate all variants of the query word
        variants = get_word_variants(qword)

        # 2. Check if any variant matches exactly
        variant_match = variants & text_words_set
        if variant_match:
            matched_words += 1
            total_confidence += 0.95  # High confidence for variant match
            continue
            
        # 2.5. Check for common typos
        if qword in COMMON_TYPOS:
            corrected_word = COMMON_TYPOS[qword]
            if corrected_word in text_words_set:
                matched_words += 1
                total_confidence += 0.90  # High confidence for known typo correction
                continue

        # 3. Check for fuzzy match with each text word
        # CRITICAL: Only allow fuzzy matching if:
        # - Words are similar length (within 1 character)
        # - Fuzzy ratio is very high (>= 0.9) to catch only real typos
        # - This prevents "caar" from matching "car" (ratio 0.857 < 0.9)
        best_fuzzy = 0.0
        best_match_word = None
        for tword in text_words:
            # Skip fuzzy matching if words are very different lengths
            # (prevents "caar" matching "car" - length diff of 1 but ratio < 0.9)
            length_diff = abs(len(qword) - len(tword))
            
            # Check fuzzy match with original word
            ratio = fuzzy_ratio(qword, tword)
            if ratio > best_fuzzy:
                best_fuzzy = ratio
                best_match_word = tword

            # Also check fuzzy match with variants
            for variant in variants:
                variant_length_diff = abs(len(variant) - len(tword))
                # Only check if lengths are close (within 2 chars)
                if variant_length_diff <= 2:
                    ratio = fuzzy_ratio(variant, tword)
                    if ratio > best_fuzzy:
                        best_fuzzy = ratio
                        best_match_word = tword

        # Apply stricter fuzzy matching: require high threshold (0.9+) and similar lengths
        # This prevents "caar" (4 chars) from matching "car" (3 chars) even if ratio is 0.857
        if best_fuzzy >= fuzzy_threshold:
            # Additional check: for short words (3-5 chars), require very high similarity (0.9+)
            # and same length to prevent false positives
            if len(qword) <= 5:
                # For short words, be very strict
                if best_fuzzy >= 0.9 and best_match_word and abs(len(qword) - len(best_match_word)) <= 1:
                    matched_words += 1
                    total_confidence += best_fuzzy * 0.85  # Slightly lower confidence for fuzzy
            else:
                # For longer words, fuzzy threshold applies as-is
                matched_words += 1
                total_confidence += best_fuzzy * 0.85  # Slightly lower confidence for fuzzy

    # Calculate overall match score
    if matched_words == 0:
        return (False, 0.0)

    # Implement AND-biased logic for compound queries
    # Single word: requires 100% match (1 word must match)
    # Two words: requires 100% match (both words must match) for high precision
    # Three+ words: requires 67% match (2 out of 3 words) for some flexibility
    
    match_ratio = matched_words / len(query_words)
    
    if len(query_words) == 1:
        # Single word queries: require exact match
        required_ratio = 1.0
    elif len(query_words) == 2:
        # Compound queries like "blue plane": require both words (AND logic)
        required_ratio = 1.0
    else:
        # Complex queries (3+ words): allow some flexibility
        required_ratio = 0.67
    
    if match_ratio < required_ratio:
        return (False, 0.0)

    avg_confidence = total_confidence / len(query_words)
    
    # Boost confidence for complete matches in compound queries
    if len(query_words) >= 2 and match_ratio == 1.0:
        avg_confidence = min(1.0, avg_confidence * 1.1)
    
    return (True, avg_confidence)


def intelligent_text_match(query: str, *texts: str, fuzzy_threshold: float = 0.9) -> Tuple[bool, float]:
    """
    Check if query matches any of the provided texts using intelligent matching.

    This is a convenience function that checks multiple text fields.

    Args:
        query: Search query
        *texts: Variable number of text strings to search in
        fuzzy_threshold: Minimum ratio for fuzzy matching

    Returns:
        Tuple of (is_match, best_confidence_score)
    """
    if not query or not query.strip():
        return (False, 0.0)
    
    if not texts:
        return (False, 0.0)
        
    best_match = False
    best_confidence = 0.0

    for text in texts:
        if text and isinstance(text, str):
            try:
                is_match, confidence = intelligent_match(query, text, fuzzy_threshold)
                if is_match and confidence > best_confidence:
                    best_match = True
                    best_confidence = confidence
            except Exception:
                # Continue processing other texts if one fails
                continue

    return (best_match, best_confidence)


def intelligent_tag_match(query: str, tags: List[str], fuzzy_threshold: float = 0.9) -> Tuple[bool, float]:
    """
    Check if query matches any of the provided tags using intelligent matching.
    
    For compound queries (2+ words), applies AND-biased logic requiring all query words
    to be found in the tags for a match, similar to intelligent_match function.

    Args:
        query: Search query
        tags: List of tags to match against
        fuzzy_threshold: Minimum ratio for fuzzy matching

    Returns:
        Tuple of (is_match, best_confidence_score)
    """
    if not query or not query.strip():
        return (False, 0.0)
        
    if not tags or not isinstance(tags, list):
        return (False, 0.0)

    try:
        query_words = tokenize(query)
        if not query_words:
            return (False, 0.0)

        # For single word queries, use the original logic
        if len(query_words) == 1:
            query_variants = get_word_variants(query_words[0])

            best_match = False
            best_confidence = 0.0

            for tag in tags:
                if not tag or not isinstance(tag, str):
                    continue
                    
                try:
                    tag_lower = tag.lower()
                    tag_variants = get_word_variants(tag_lower)

                    # Check for exact tag match with any variant
                    if tag_lower in query_variants or query_variants & tag_variants:
                        return (True, 1.0)

                    # Check fuzzy match
                    for qvariant in query_variants:
                        for tvariant in tag_variants:
                            try:
                                ratio = fuzzy_ratio(qvariant, tvariant)
                                if ratio >= fuzzy_threshold and ratio > best_confidence:
                                    best_match = True
                                    best_confidence = ratio
                            except Exception:
                                continue
                except Exception:
                    # Skip problematic tags
                    continue

            return (best_match, best_confidence)
        
        # For compound queries (2+ words), apply AND-biased logic
        # Create a combined text from all tags to search in
        all_tags_text = ' '.join(str(tag) for tag in tags if tag and isinstance(tag, str))
        
        # Use the same AND-biased logic as intelligent_match
        return intelligent_match(query, all_tags_text, fuzzy_threshold)
            
    except Exception:
        # Return safe fallback if entire function fails
        return (False, 0.0)
