// import { exceptions as stream_framework_exceptions } from 'stream_framework';
// import { datetime_to_epoch, make_list_unique } from 'stream_framework/utils';
// import { long_t } from 'stream_framework/utils/five';
// import * as datetime from 'datetime';
// import * as uuid from 'uuid';
// import * as six from 'six';

const MAX_AGGREGATED_ACTIVITIES_LENGTH = 15;

export class BaseActivity {
  /*
    Common parent class for Activity and Aggregated Activity
    Check for this if you want to see if something is an activity
  */
}

class DehydratedActivity extends BaseActivity {
  /*
    The dehydrated verions of an :class:`Activity`.
    the only data stored is serializationId of the original

    Serializers can store this instead of the full activity
    Feed classes
  */

  serializationId: number;
  _activity_ids: number[];
  dehydrated: boolean;

  constructor(serializationId: number) {
    super();
    this.serializationId = serializationId;
    this._activity_ids = [serializationId];
    this.dehydrated = true;
  }

  get_hydrated(activities) {
    /*
      returns the full hydrated Activity from activities
      :param activities a dict {'activity_id': Activity}
    */
    const activity = activities[this.serializationId];
    activity.dehydrated = false;
    return activity;
  }
}

interface ActivityObject {
  id: number;
}

export class Activity extends BaseActivity {
  /*
    Wrapper class for storing activities
    Note

    actorId
    target_id
    and objectId are always present

    actor, target and object are lazy by default
  */
  verb: ActivityObject;
  actor: ActivityObject | null;
  object: ActivityObject | null;
  target: ActivityObject | null;
  actorId: number;
  objectId: number;
  targetId: number | null;
  time: Date;
  extra_context: any;
  dehydrated: boolean;

  constructor(
    actor: number | ActivityObject,
    verb: ActivityObject,
    object: number | ActivityObject,
    target: number | ActivityObject | null = null,
    time = null,
    extra_context = null
  ) {
    super();
    this.verb = verb;
    this.time = time || new Date();

    this.actor = typeof actor === 'number' ? null : actor;
    this.object = typeof object === 'number' ? null : object;
    this.target = typeof target === 'number' ? null : target;

    this.actorId = typeof actor === 'number' ? actor : actor.id;
    this.objectId = typeof object === 'number' ? object : object.id;
    this.targetId = typeof target === 'number' ? target : target?.id ?? null;

    this.extra_context = extra_context || {};
    this.dehydrated = false;
  }

  // returns the dehydrated version of the current activity
  get_dehydrated() {
    return new DehydratedActivity(this.serializationId);
  }

  __eq__(other: Activity) {
    if (!(other instanceof Activity)) {
      throw new Error(
        `Can only compare to Activity not ${other} of type ${Object.getPrototypeOf(
          other
        )}`
      );
    }

    return this.serializationId === other.serializationId;
  }
  __lt__(other: Activity) {
    return this.serializationId < other.serializationId;
  }

  get serializationId() {
    /*
        serializationId is used to keep items locally sorted and unique
        (eg. used redis sorted sets' score or cassandra column names)

        serializationId is also used to select random activities from the feed
        (eg. remove activities from feeds must be fast operation)
        for this reason the serializationId should be unique and not change over time

        eg:
        activity.serializationId = 1373266755000000000042008
        1373266755000 activity creation time as epoch with millisecond resolution
        0000000000042 activity left padded objectId (10 digits)
        008 left padded activity verb id (3 digits)

        :returns: int --the serialization id
    */

    if (this.objectId >= Math.pow(10, 10) || this.verb.id >= Math.pow(10, 3)) {
      throw new TypeError('Fatal: objectId / verb have too many digits !');
    }
    if (!this.time) {
      throw new TypeError('Cant serialize activities without a time');
    }
    const milliseconds = this.time.getTime().toString();
    const paddedObjectId = this.objectId.toString().padStart(10, '0');
    const paddedVerbId = this.verb.id.toString().padStart(3, '0');
    const serializationIdStr = `${milliseconds}${paddedObjectId}${paddedVerbId}`;
    const serializationId = Number.parseInt(serializationIdStr);
    return serializationId;
  }
}

export class AggregatedActivity extends BaseActivity {
  group: string;
  created_at: Date | null;
  updated_at: Date | null;
  activities: Activity[];
  seen_at: Date | null = null;
  read_at: Date | null = null;
  minimized_activities = 0;
  dehydrated = false;
  _activity_ids: number[] = [];
  /*
    Object to store aggregated activities
  */
  constructor(
    group: string,
    activities: Activity[] = null,
    created_at = null,
    updated_at = null
  ) {
    super();
    this.group = group;
    this.activities = activities || [];
    this.created_at = created_at;
    this.updated_at = updated_at;
  }

  // serializationId is used to keep items locally sorted and unique
  // (eg. used redis sorted sets' score or cassandra column names)
  // serializationId is also used to select random activities from the feed
  // (eg. remove activities from feeds must be fast operation)
  // for this reason the serializationId should be unique and not change over time
  // eg:
  // activity.serializationId = 1373266755000000000042008
  // 1373266755000 activity creation time as epoch with millisecond resolution
  // 0000000000042 activity left padded objectId (10 digits)
  // 008 left padded activity verb id (3 digits)
  // :returns: int --the serialization id
  get serializationId() {
    return `${Math.round(this.updated_at.getTime() / 100)}`; // TODO: this.updated_at might be null
  }

  // returns the dehydrated version of the current activity
  get_dehydrated = () => {
    if (this.dehydrated) {
      return this;
    }
    this._activity_ids = this.activities.map(
      activity => activity.serializationId
    );
    this.activities = [];
    this.dehydrated = true;

    return this;
  };

  // expects activities to be a dict like this {'activity_id': Activity}
  get_hydrated = activities => {
    if (!this.dehydrated) {
      return this;
    }
    this._activity_ids.forEach(id => {
      this.activities.push(activities[id]);
    });
    this._activity_ids = [];
    this.dehydrated = false;
    return this;
  };

  // __len__ =  () => {
  //     '''
  //     Works on both hydrated and not hydrated activities
  //     '''
  //     if this._activity_ids:
  //         length = len(this.activity_ids)
  //     else:
  //         length = len(this.activities)
  //     return length

  // Returns a list of activity ids
  get activity_ids() {
    if (this._activity_ids) {
      return this._activity_ids;
    }
    return this.activities.map(a => a.serializationId);
  }

  // __eq__ = (other)=> {
  //     if not isinstance(other, AggregatedActivity):
  //         raise ValueError(
  //             'I can only compare aggregated activities to other aggregated activities')
  //     equal = True
  //     date_fields = ['created_at', 'updated_at', 'seen_at', 'read_at']
  //     for field in date_fields:
  //         current = getattr(field)
  //         other_value = getattr(other, field)
  //         if isinstance(current, datetime.datetime) and isinstance(other_value, datetime.datetime):
  //             delta = abs(current - other_value)
  //             if delta > datetime.timedelta(seconds=10):
  //                 equal = False
  //                 break
  //         else:
  //             if current != other_value:
  //                 equal = False
  //                 break

  //     if this.activities != other.activities:
  //         equal = False

  //     return equal

  // __hash__ =  () => {
  //     return hash(this.serializationId)

  // Checks if activity is present in this aggregated
  contains = activity => {
    // if not isinstance(activity, (Activity, long_t, uuid.UUID)):
    //     raise ValueError('contains needs an activity or long not %s', activity)
    const activityId = activity.serializationId || activity;

    return this.activities.some(a => a.serializationId === activityId);
  };

  append = (activity: Activity) => {
    if (this.contains(activity)) {
      throw new Error('Duplicate Activity');
    }

    //  append the activity
    this.activities.push(activity);

    //  set the first seen
    if (this.created_at === null) {
      this.created_at = activity.time;
    }

    //  set the last seen
    if (this.updated_at === null || activity.time > this.updated_at) {
      this.updated_at = activity.time;
    }

    //  ensure that our memory usage, and pickling overhead don't go up
    //  endlessly
    if (this.activities.length > MAX_AGGREGATED_ACTIVITIES_LENGTH) {
      this.activities.pop();
      this.minimized_activities += 1;
    }
  };

  remove = (activity: Activity) => {
    if (!this.contains(activity)) {
      return;
    }

    if (this.activities.length === 1) {
      throw new Error(
        'Removing this activity would leave an empty aggregation'
      );
    }

    const activityId = activity.serializationId || activity;
    this.activities = this.activities.filter(
      a => a.serializationId !== activityId
    );

    // now time to update the times
    this.updated_at = this.last_activity.time;

    // adjust the count
    if (this.minimized_activities) {
      this.minimized_activities -= 1;
    }
  };

  remove_many = activities => {
    const removed_activities = [];
    activities.forEach(activity => {
      if (this.contains(activity)) {
        this.remove(activity);
        removed_activities.push(activity);
      }
    });

    return removed_activities;
  };

  // Returns a count of the number of actors
  // When dealing with large lists only approximate the number of actors
  get actor_count() {
    return this.minimized_activities + this.actor_ids.length;
  }
  get other_actor_count() {
    return this.actor_count - 1;
  }
  // Returns the number of activities
  get activity_count() {
    return this.minimized_activities + this.activities.length;
  }
  get last_activity() {
    return this.activities[this.activities.length - 1];
  }
  get last_activities() {
    return [...this.activities].reverse();
  }
  get verb() {
    return this.activities[0].verb;
  }
  get verbs() {
    const seen = {};
    const verbs = [];
    this.activities.forEach(a => {
      if (seen[a.verb.id]) {
        return;
      }
      seen[a.verb.id] = true;
      verbs.push(a.verb);
    });

    return verbs;
  }
  get actor_ids() {
    const seen = {};
    const actor_ids = [];
    this.activities.forEach(a => {
      if (seen[a.actorId]) {
        return;
      }
      seen[a.actorId] = true;
      actor_ids.push(a.actorId);
    });

    return actor_ids;
  }

  get object_ids() {
    const seen = {};
    const object_ids = [];
    this.activities.forEach(a => {
      if (seen[a.objectId]) {
        return;
      }
      seen[a.objectId] = true;
      object_ids.push(a.objectId);
    });

    return object_ids;
  }

  // Returns if the activity should be considered as seen at this moment
  is_seen = () => {
    return this.seen_at !== null && this.seen_at >= this.updated_at;
  };
  // A hook method that updates the seen_at to current date
  update_seen_at = () => {
    this.seen_at = new Date();
  };

  // Returns if the activity should be considered as seen at this moment
  is_read = () => {
    return this.read_at !== null && this.read_at >= this.updated_at;
  };
  // A hook method that updates the read_at to current date
  update_read_at = () => {
    this.read_at = new Date();
  };
}
