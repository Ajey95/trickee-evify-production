import React from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Check, X } from "lucide-react";

interface TripHistoryTableProps {
  trips: any[];
}

export const TripHistoryTable = ({ trips }: TripHistoryTableProps) => {
  if (!trips.length) {
    return (
      <div className="border border-bg-border rounded-xl p-6 text-sm text-text-dim">
        No trip history is available for this driver yet.
      </div>
    );
  }

  return (
    <div className="border border-bg-border rounded-xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Started</TableHead>
            <TableHead>Origin</TableHead>
            <TableHead>Destination</TableHead>
            <TableHead>Route Taken</TableHead>
            <TableHead>Recommended</TableHead>
            <TableHead>Nudge Followed</TableHead>
            <TableHead>Energy (kWh)</TableHead>
            <TableHead>SOC</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trips.map((trip) => (
            <TableRow key={trip.id}>
              <TableCell className="font-mono text-xs">
                {trip.started_at ? new Date(trip.started_at).toLocaleString() : "Unknown"}
              </TableCell>
              <TableCell className="font-medium">{trip.origin_label || "GPS inferred"}</TableCell>
              <TableCell>{trip.dest_label || "GPS inferred"}</TableCell>
              <TableCell>{trip.route_taken || "Unknown"}</TableCell>
              <TableCell className="text-text-dim">{trip.recommended_route || "None"}</TableCell>
              <TableCell>
                {trip.followed_nudge === null || trip.followed_nudge === undefined ? (
                  <span className="text-xs text-text-dim">No outcome</span>
                ) : trip.followed_nudge ? (
                  <Badge variant="success" className="px-1.5"><Check className="w-3 h-3 mr-1" /> Followed</Badge>
                ) : (
                  <Badge variant="error" className="px-1.5"><X className="w-3 h-3 mr-1" /> Ignored</Badge>
                )}
              </TableCell>
              <TableCell className="font-mono">{typeof trip.kwh_used === "number" ? trip.kwh_used.toFixed(2) : "-"}</TableCell>
              <TableCell className="font-mono">
                {typeof trip.soc_start === "number" || typeof trip.soc_end === "number"
                  ? `${trip.soc_start ?? "-"}% -> ${trip.soc_end ?? "-"}%`
                  : "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
