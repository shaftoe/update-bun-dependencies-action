/** A map of package name → version range as found in package.json */
export type DependencyMap = Record<string, string>;

/** All dependency sections we care about from package.json */
export interface PackageJson {
  name?: string;
  dependencies?: DependencyMap;
  devDependencies?: DependencyMap;
  optionalDependencies?: DependencyMap;
  peerDependencies?: DependencyMap;
}

/** The "latest" info resolved from the npm registry */
export interface ResolvedLatest {
  version: string;
}

/** Describes a single package update */
export interface PackageUpdate {
  from: string;
  to: string;
}

/** Map of package name → update info */
export type UpdateMap = Record<string, PackageUpdate>;
