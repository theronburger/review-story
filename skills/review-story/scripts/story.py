"""Review input and audio cue validation."""
import json
import math
import re
from pathlib import Path


def utf16_length(text):
    return len(text.encode('utf-16-le')) // 2


def validate_map_annotations(map_spec):
    for collection, coordinates, text_key in (
        ('sections', ('x', 'y', 'width'), 'label'),
        ('boundaries', ('x1', 'y1', 'x2', 'y2', 'labelX', 'labelY'), 'label'),
        ('captions', ('x', 'y'), 'text'),
    ):
        for item in map_spec.get(collection, []):
            if not isinstance(item.get(text_key), str) or not item[text_key].strip():
                raise ValueError(f'Map {collection} need text')
            if any(type(item.get(key)) not in (int, float) or not math.isfinite(item[key])
                   for key in coordinates):
                raise ValueError(f'Map {collection} need finite coordinates')
            if collection == 'sections' and item['width'] <= 0:
                raise ValueError('Map section width must be positive')
            if item.get('anchor', 'start') not in ('start', 'middle', 'end'):
                raise ValueError('Invalid map text anchor')


def read_review(path):
    review = json.loads(Path(path).read_text())
    for key in ('title', 'subtitle', 'source', 'legend', 'map', 'sequences', 'cards'):
        if key not in review:
            raise ValueError(f'Missing review field: {key}')
    if review.get('initialPage', 'sequences') not in ('map', 'sequences'):
        raise ValueError('Unknown initial page')
    if 'playThrough' in review and type(review['playThrough']) is not bool:
        raise ValueError('playThrough must be a boolean')
    if not review['map']['beats'] or not review['sequences']:
        raise ValueError('Both pages need narration')
    nodes = review['map']['nodes']
    validate_map_annotations(review['map'])
    if any(node['side'] not in ('changed', 'context') for node in nodes):
        raise ValueError('Unknown map legend category')
    node_ids = [node['id'] for node in nodes]
    if len(set(node_ids)) != len(node_ids):
        raise ValueError('Duplicate map node IDs')
    ids = node_ids + [sequence['id'] for sequence in review['sequences']] + list(review['cards'])
    if any(not re.fullmatch(r'[a-z0-9-]+', value) for value in ids):
        raise ValueError('IDs must use lowercase letters, digits and hyphens')
    for edge in review['map']['edges']:
        if edge['from'] not in node_ids or edge['to'] not in node_ids:
            raise ValueError('Map edge has an unknown endpoint')
        if not re.fullmatch(r'[MmLlHhVvCcSsQqTtAaZz0-9., +\-]+', edge['d']):
            raise ValueError('Invalid SVG path')
    for beat in review['map']['beats']:
        if beat['target'] not in node_ids:
            raise ValueError('Map beat has an unknown target')
    sequence_ids = [sequence['id'] for sequence in review['sequences']]
    if len(set(sequence_ids)) != len(sequence_ids):
        raise ValueError('Duplicate sequence IDs')
    for sequence in review['sequences']:
        if len(sequence['actors']) < 2 or not sequence['rows']:
            raise ValueError('A sequence needs actors and beats')
        for row in sequence['rows']:
            if not row['cards'] or any(card not in review['cards'] for card in row['cards']):
                raise ValueError('Row needs available source cards')
            for message in row['messages']:
                if message['kind'] not in ('call', 'return', 'local'):
                    raise ValueError('Message kind must be call, return or local')
                if not all(0 <= message[end] < len(sequence['actors']) for end in ('from', 'to')):
                    raise ValueError('Message actor is out of range')
                if (message['kind'] == 'local') != (message['from'] == message['to']):
                    raise ValueError('Only local work uses a self-loop')
            positions = []
            for phase in row['phases']:
                if not phase['ranges']:
                    raise ValueError('Cue needs highlighted source lines')
                if row['text'].count(phase['phrase']) != 1:
                    raise ValueError(f"Cue phrase must occur exactly once: {phase['phrase']}")
                positions.append(row['text'].index(phase['phrase']))
                if phase['card'] not in row['cards'] or phase['card'] not in review['cards']:
                    raise ValueError('Cue refers to an unavailable source card')
                if not 0 <= phase['message'] < len(row['messages']):
                    raise ValueError('Cue message is out of range')
                if phase.get('point', 'diagram') not in ('diagram', 'code'):
                    raise ValueError('Pointer target must be diagram or code')
                if 'codeTarget' in phase:
                    target = phase['codeTarget']
                    if phase.get('point') != 'code' or not isinstance(target, dict):
                        raise ValueError('codeTarget requires a code pointer')
                    if type(target.get('line')) is not int or target['line'] < 1:
                        raise ValueError('codeTarget needs a positive source line')
                    text = target.get('text')
                    if not isinstance(text, str) or not text.strip() or '\n' in text or '\r' in text:
                        raise ValueError('codeTarget text must be nonempty and on one source line')
                    if 'occurrence' in target and (type(target['occurrence']) is not int or target['occurrence'] < 1):
                        raise ValueError('codeTarget occurrence must be a positive integer')
            if not positions or positions != sorted(set(positions)):
                raise ValueError('Cues must follow narration order')
    return review


def tracks(review):
    map_beats = [dict(beat) for beat in review['map']['beats']]
    sequence_beats = []
    for sequence in review['sequences']:
        for index, row in enumerate(sequence['rows']):
            sequence_beats.append(dict(row, target=f"{sequence['id']}-{index}",
                                       diagram=sequence['id'], row=index,
                                       title=f"{sequence['title']} · {index + 1} / {len(sequence['rows'])}"))
    return {'map': map_beats, 'sequences': sequence_beats}
