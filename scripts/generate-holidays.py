#!/usr/bin/env python3
import csv
import json
import sys

SOURCE = "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv"
YEARS = {2026, 2027}


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: generate-holidays.py <syukujitsu.csv> <output.json>", file=sys.stderr)
        sys.exit(1)

    src, dest = sys.argv[1], sys.argv[2]
    holidays = []
    with open(src, encoding="cp932", newline="") as handle:
        reader = csv.reader(handle)
        next(reader, None)
        for row in reader:
            if len(row) < 2:
                continue
            date_raw = row[0].strip()
            name = row[1].strip()
            if not date_raw:
                continue
            parts = date_raw.split("/")
            if len(parts) != 3:
                print(f"bad date: {date_raw}", file=sys.stderr)
                sys.exit(1)
            year, month, day = (int(part) for part in parts)
            if year not in YEARS:
                continue
            holidays.append(
                {
                    "date": f"{year:04d}-{month:02d}-{day:02d}",
                    "name": name,
                }
            )

    payload = {
        "source": SOURCE,
        "encoding": "cp932",
        "years": [2026, 2027],
        "holidays": holidays,
    }
    with open(dest, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


if __name__ == "__main__":
    main()
