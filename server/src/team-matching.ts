const aliases: Record<string, string> = {
  "nottinghamforest": 'nottinghamforest',
  "nottinghamforestfc": 'nottinghamforest',
  "nottmforest": 'nottinghamforest',
  "spurs": 'tottenhamhotspur',
  "tottenhamhotspur": 'tottenhamhotspur',
  "brighton": 'brightonandhovealbion',
  "brightonandhovealbion": 'brightonandhovealbion',
  "manutd": 'manchesterunited',
  "manchesterunited": 'manchesterunited',
  "mancity": 'manchestercity',
  "manchestercity": 'manchestercity',
  "leeds": 'leedsunited',
  "leedsunited": 'leedsunited',
};

export function normalizeTeamName(name: string): string {
  return name
    .toLocaleLowerCase('en')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function teamKey(name: string): string {
  const normalized = normalizeTeamName(name);
  return aliases[normalized] ?? normalized;
}

export function teamsMatch(first: string, second: string): boolean {
  return teamKey(first) === teamKey(second);
}
