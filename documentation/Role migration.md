# Role migration — run before testing

Your routes used `user` / `municipality` / `admin`. The User schema now uses
`citizen` / `officer` / `admin`. Existing user documents still hold the old
values, so they will fail the enum on next save and fail every `requireRole`
check.

## 1. Check what's actually in the DB

```js
db.users.aggregate([{ $group: { _id: "$role", n: { $sum: 1 } } }])
db.users.findOne()          // does it have `uid` or `firebaseUid`?
```

## 2. Migrate roles

```js
db.users.updateMany({ role: "user" },         { $set: { role: "citizen" } })
db.users.updateMany({ role: "municipality" }, { $set: { role: "officer"  } })
```

## 3. Migrate the UID field, if needed

Only if step 1 showed `uid` rather than `firebaseUid`:

```js
db.users.updateMany(
  { uid: { $exists: true }, firebaseUid: { $exists: false } },
  [{ $set: { firebaseUid: "$uid" } }]
)
```

Confirm a login works, then `db.users.updateMany({}, { $unset: { uid: "" } })`.

## 4. Give every officer a department

`User.pre('validate')` rejects an officer with no department, so migrated
`municipality` users cannot be saved until this runs. Departments must be one
of: `road`, `water`, `electric`, `sanitation`, `other`.

```js
db.users.updateMany(
  { role: "officer", department: { $exists: false } },
  { $set: { department: "other" } }
)
```

Then set the real ones per officer, or use `PATCH /api/admin/users/:id/role`.

## 5. Create your first admin by hand

There is no route that mints an admin — deliberately. Promote one account
directly:

```js
db.users.updateOne({ email: "you@example.com" }, { $set: { role: "admin" } })
```

## 6. Legacy status values

Old issues may carry `status: "pending"`. It is still in the enum so nothing
breaks, and `STATUS_LABELS` renders it identically to `open`. Normalise if you
want a clean demo:

```js
db.issues.updateMany({ status: "pending" }, { $set: { status: "open" } })
```