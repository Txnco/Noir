"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

export default function SelectFilter({
  param,
  placeholder,
  options,
}: {
  param: string;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get(param) ?? ALL;

  function change(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === ALL) next.delete(param);
    else next.set(param, value);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <Select value={current} onValueChange={change}>
      <SelectTrigger size="sm" className="w-[170px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
