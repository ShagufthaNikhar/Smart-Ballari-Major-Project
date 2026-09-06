// ===================================================================
//  SAVE THIS AS:   backend/serializers/issue.js
//  This is the SERIALIZER. It must start with require('../config/departments').
//  It contains NO mongoose schema.
// ===================================================================
const { DEPARTMENTS, STATUS_LABELS } = require('../config/departments');

/**
 * CITIZEN VIEW - the only shape that may ever be sent to role 'citizen'.
 *
 * Deliberately omitted:
 *   assignedOfficer, assignedTo, officerRemarks, imageRef, aiConf, aiTagged,
 *   aiSuggestedCategory, flags, flaggedBy, reporterTrustScore, reportedBy,
 *   raw upvotes/downvotes UID arrays, timeline[].message, timeline[].updatedBy
 *
 * This is an ALLOW-LIST. Fields are copied in one at a time, so a field
 * added to the schema later cannot leak by accident.
 */
function toCitizenView(i) {
  const dept = DEPARTMENTS[i.category] || DEPARTMENTS.other;
  const last = i.timeline && i.timeline.length
    ? i.timeline[i.timeline.length - 1]
    : null;

  const view = {
    // The community routes look issues up with findById, so the feed needs
    // the ObjectId. Without it home.js was posting votes and flags to
    // /api/community/issues/undefined/... . grievanceId stays the human
    // handle; this is just the lookup key.
    id:          i._id,
    grievanceId: i.grievanceId,
    title:       i.title,
    description: i.description,
    imageUrl:    i.imageUrl,
    location:    i.location,

    category:                   i.category,
    department:                 dept.label,
    departmentGrievanceContact: dept.grievanceContact,
    departmentGrievanceEmail:   dept.grievanceEmail,

    status:      i.status,
    statusLabel: STATUS_LABELS[i.status] || i.status,
    priority:    i.priority,
    verified:    i.verified,

    reportedAt:  i.createdAt,
    lastUpdated: last ? last.timestamp : i.updatedAt,

    // Counts only. The raw arrays hold voter UIDs.
    upvotes:   (i.upvotes   || []).length,
    downvotes: (i.downvotes || []).length,
    voteScore: i.voteScore,

    // Status + timestamp only. No actor, no internal message.
    timeline: (i.timeline || []).map(e => ({
      status: e.status,
      label:  STATUS_LABELS[e.status] || e.status,
      at:     e.timestamp
    }))
  };

  if (i.status === 'resolved' && i.resolutionEvidenceUrl) {
    view.resolutionEvidenceUrl = i.resolutionEvidenceUrl;
  }
  return view;
}

/**
 * PUBLIC VIEW - for the map and community feed, where other citizens browse.
 * Drops the grievance email so one citizen's ticket is not a contact surface.
 */
function toPublicView(i) {
  const view = toCitizenView(i);
  delete view.departmentGrievanceEmail;
  return view;
}

/** OFFICER VIEW - full working record for the handling department. */
function toOfficerView(i) {
  const dept = DEPARTMENTS[i.category] || DEPARTMENTS.other;
  const o = i.assignedOfficer;

  return {
    grievanceId: i.grievanceId,
    title:       i.title,
    description: i.description,
    imageUrl:    i.imageUrl,
    location:    i.location,

    category:      i.category,
    department:    dept.label,
    departmentKey: i.category,

    status:     i.status,
    priority:   i.priority,
    verified:   i.verified,
    reportedAt: i.createdAt,
    acceptedAt: i.acceptedAt,
    resolvedAt: i.resolvedAt,

    assignedOfficer: o && o._id
      ? { id: o._id, name: o.name, designation: o.designation, employeeId: o.employeeId }
      : null,

    officerRemarks:        i.officerRemarks,
    resolutionEvidenceUrl: i.resolutionEvidenceUrl,

    aiTagged:            i.aiTagged,
    aiConf:              i.aiConf,
    aiSuggestedCategory: i.aiSuggestedCategory,
    flags:               i.flags,

    voteScore: i.voteScore,
    upvotes:   (i.upvotes   || []).length,
    downvotes: (i.downvotes || []).length,

    timeline: i.timeline
  };
}

/** ADMIN VIEW - officer view plus reporter identity and trust signals. */
function toAdminView(i, reporter) {
  const base = toOfficerView(i);
  base.id                 = i._id;
  base.reportedBy         = i.reportedBy;
  base.reporterTrustScore = i.reporterTrustScore;
  base.assignedToLegacy   = i.assignedTo;
  if (reporter) {
    base.reporter = {
      id: reporter._id, name: reporter.name,
      email: reporter.email, phone: reporter.phone
    };
  }
  return base;
}

module.exports = { toCitizenView, toPublicView, toOfficerView, toAdminView };