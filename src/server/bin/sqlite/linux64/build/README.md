# sqlite3-x64
As SQLite doesn't provide 64-bit versions of its precompiled binaries, I have
decided to provide them myself since building those tools (`sqldiff`, `sqlite3`,
and `sqlite3_analyzer`) can be quite time-consuming, and wildly inconvenient
when you are trying to access your database for a quick query...

[**RELEASES**](https://github.com/boramalper/sqlite3-x64/releases)

- **`sqldiff`**
- **`sqlite3`**
- **`sqlite3_analyzer`**
- **`CHECKSUMS.sha1`**

  SHA-1 checksums of the binaries `sqldiff`, `sqlite3`, and `sqlite3_analyzer`.
- **`sqlite-tools-linux-x64-<VERSION>.zip`**

   ZIP archive of the binaries `sqldiff`, `sqlite3`, and `sqlite3_analyzer`.
- **`sqlite-tools-linux-x64-<VERSION>.zip.sha1`**


## Building Process
1. This repository contains a file called `sqlite-src.url` which contains the
   URL to the source code of the latest release of SQLite.

2. Whenever changes are pushed to [the GitHub repository](https://github.com/boramalper/sqlite3-x64),
   [Travis CI](https://travis-ci.org/boramalper/sqlite3-x64):
   1. Compiles the binaries and zips them
   2. Creates a new [release](https://github.com/boramalper/sqlite3-x64/releases)
   3. Deploys the binaries

## Security
You might reasonably be concerned about whether the precompiled binaries are
tampered by me or not, for which you can check the `.travis.yml` file, and the
build log on [Travis CI](https://travis-ci.org/boramalper/sqlite3-x64)
which shows how the tools are compiled, and the SHA-1 sums of the SQLite source
zip (`sqlite-src-*.zip`), of the binaries, and of the final zip file
(`sqlite-tools-linux-x64-*.zip`).

## Release Process
To release the precompiled binaries for the newest version of SQLite:

1. Update `sqlite-src.url` with the URL of the source zip (`sqlite-src-*.zip`)

   ```
   https://www.sqlite.org/2018/sqlite-src-3240000.zip
   ```

2. Update `sqlite-src.sha1` with the SHA1 checksum of the source zip.

   **Beware** of the formatting: SHA1 checksum, seperated by two spaces, and the
   file name, on a single line

   ```
   fb558c49ee21a837713c4f1e7e413309aabdd9c7  sqlite-src-3240000.zip
   ```

3. Update `env` with the version number:

   ```
   S64_VERSION=3240000
   ```

4. Commit changes, and push.

   **Beware** of your commit message:

   - All release commit messages must be of the format `[release] <VERSION>`.
   - For all other changes, commit messages must be prefixed with `[other]`.
