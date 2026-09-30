function createDemoStream(text, start, duration) {
  const chunks = [];
  let cursor = 0, weight = 0;
  while (cursor < text.length) {
    const remaining = text.length - cursor;
    const size = remaining <= 3 ? remaining : remaining === 4 ? 2 : chunks.length % 2 ? 3 : 2;
    cursor += size;
    weight += .075 * Math.exp(-chunks.length / 18) + .002;
    chunks.push({end: cursor, weight});
  }
  for (const chunk of chunks) chunk.at = start + duration * chunk.weight / weight;
  return {
    chunks,
    at(time) {
      let left = 0, right = chunks.length;
      while (left < right) {
        const middle = Math.floor((left + right) / 2);
        if (chunks[middle].at <= time) left = middle + 1;
        else right = middle;
      }
      return text.slice(0, left ? chunks[left - 1].end : 0);
    },
  };
}
