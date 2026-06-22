#!/usr/bin/env swift
import EventKit
import Foundation

let store = EKEventStore()
let sema = DispatchSemaphore(value: 0)

if #available(macOS 14.0, *) {
    store.requestFullAccessToReminders { granted, _ in
        guard granted else {
            print(#"{"success":false,"error":"access denied"}"#)
            exit(1)
        }
        sema.signal()
    }
} else {
    store.requestAccess(to: .reminder) { granted, _ in
        guard granted else {
            print(#"{"success":false,"error":"access denied"}"#)
            exit(1)
        }
        sema.signal()
    }
}
sema.wait()

let sema2 = DispatchSemaphore(value: 0)
let predicate = store.predicateForIncompleteReminders(withDueDateStarting: nil, ending: nil, calendars: nil)
var reminders: [EKReminder] = []

store.fetchReminders(matching: predicate) { results in
    reminders = results ?? []
    sema2.signal()
}
sema2.wait()

let iso = ISO8601DateFormatter()
var items: [[String: Any]] = []

for r in reminders {
    var item: [String: Any] = [
        "list": r.calendar.title,
        "name": r.title,
        "priority": r.priority
    ]
    if let comps = r.dueDateComponents, let date = Calendar.current.date(from: comps) {
        item["dueDate"] = iso.string(from: date)
    }
    if let notes = r.notes, !notes.isEmpty {
        item["description"] = notes
    }
    items.append(item)
}

let result: [String: Any] = ["success": true, "count": items.count, "reminders": items]
let jsonData = try! JSONSerialization.data(withJSONObject: result, options: [])
print(String(data: jsonData, encoding: .utf8)!)