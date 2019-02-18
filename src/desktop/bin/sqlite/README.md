## SQLite Executable binaries

The sub-directories in this directory contain the native SQLite executable binaries for all supported operating systems.

All binaries were downloaded from the official SQLite site (https://sqlite.org/download.html), except for the 64-bit Linux executables found in the <code>linux64</code> folder which were downloaded from Bora M. Alper's build repository (https://github.com/boramalper/sqlite3-x64/releases).

Required files for building the 64-bit Linux executables are included in the <code>linux64/build</code> directory which is a copy of the repository <code>trunk</code> (https://github.com/boramalper/sqlite3-x64). Refer to the <code>linux64/build/README.md</code> file for instructions on building these binaries from source code.

Currently only Windows 32-bit binaries (<code>win32</code>) are available for both 32 and 64-bit architectures.
