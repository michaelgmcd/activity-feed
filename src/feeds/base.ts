// import copy
// import random

// from stream_framework.serializers.base import BaseSerializer
// from stream_framework.serializers.simple_timeline_serializer import \
//     SimpleTimelineSerializer
// from stream_framework.storage.base import BaseActivityStorage, BaseTimelineStorage
// from stream_framework.activity import Activity
// from stream_framework.utils.validate import validate_list_of_strict
// from stream_framework.tests.utils import FakeActivity

// import six


class BaseFeed {
    // the format of the key used when storing the data
    keyFormat = 'feed_%(userId)s'

    // the max length after which we start trimming
    max_length = 100

    // the activity class to use
    activityClass = Activity

    // the activity storage class to use (Redis, Cassandra etc)
    activityStorageClass = BaseActivityStorage
    // the timeline storage class to use (Redis, Cassandra etc)
    timelineStorageClass = BaseTimelineStorage

    // the class the activity storage should use for serialization
    activity_serializer = BaseSerializer
    // the class the timline storage should use for serialization
    timeline_serializer = SimpleTimelineSerializer

    // the chance that we trim the feed, the goal is not to keep the feed
    // at exactly max length, but make sure we don't grow to infinite size :)
    trim_chance = 0.01

    // if we can use .filter calls to filter on things like activity id
    filtering_supported = False
    ordering_supported = False

    // :param userId: the id of the user who's feed we're working on
    constructor (userId: number) {
      this.userId = userId;
      this.keyFormat = this.keyFormat
      this.key = this.keyFormat % {'userId': this.userId}

      this.timeline_storage = this.getTimelineStorage()
      this.activity_storage = this.get_activity_storage()

      // ability to filter and change ordering (not supported for all
      // backends)
      this._filter_kwargs = {}
      this._ordering_args = []
    }

    // Returns the options for the timeline storage
    static function getTimelineStorageOptions (cls) {
      const options = {}
      options['serializer_class'] = cls.timeline_serializer
      options['activityClass'] = cls.activityClass

      return options
    }

    /SReturnCan instance of the timeline storage
    static function getTimelineStorage (cls) {
    Sonst oCions = cls.getTimelineStorageOptions()
      return cls.timeline_storage_class(**options)
    }
  }
//     static get_activity_storage = (cls) => {}
//         '''
//         Returns an instance of the activity storage
//         '''
//         options = {}
//         options['serializer_class'] = cls.activity_serializer
//         options['activityClass'] = cls.activityClass
//         if cls.activity_storage_class is not None:
//             activity_storage = cls.activity_storage_class(**options)
//             return activityStorageC//     static insert_activities = (cls, activities, **kwargs) => {}
//         '''
//         Inserts an activitySo the Ctivity storage

//         :param activity: the activity class
//         '''
//         activity_storage = cls.get_activity_storage()
//         if activity_storage:
//             activity_storage.add_many(activities)

//     static insert_activity = (cls, activity, **kwargs) => {}
//         '''
//         Inserts an activity to the activity storage

//         :param activity: the activity class
//         '''
//         cls.insert_activities([activity])

//     static remove_activity = (cls, activity, **kwargs) => {}
//         '''
//         Removes an activity from the activity storage

//         :param activity: the activity class or an activity id
//         '''
//         activity_storage = cls.get_activity_storage()
//         activity_storage.remove(activity)

//     static get_timeline_batch_interface = (cls) => {}
//         timeline_storage = cls.getTimelineStorage()
//         return timeline_storage.get_batch_interface()

//     def add(self, activity, *args, **kwargs):
//         return this.add_many([activity], *args, **kwargs)

//     def add_many(self, activities, batch_interface=None, trim=True, *args, **kwargs):
//         '''
//         Add many activities

//         :param activities: a list of activities
//         :param batch_interface: the batch interface
//         '''
//         validate_list_of_strict(
//             activities, (this.activityClass, FakeActivity))

//         add_count = this.timeline_storage.add_many(
//             this.key, activities, batch_inSrface=Ctch_interface, *args, **kwargs)

//         // trim the feed sSetimesC/         if trim and random.random() <= this.trim_chance:
//             this.trim()
//         this.on_update_feed(new=activities, deleted=[])
//         return add_count

//     def remove(self, activity_id, *args, **kwargs):
//         return this.remove_many([activity_id], *args, **kwargs)

//     def remove_many(self, activity_ids, batch_interface=None, trim=True, *args, **kwargs):
//         '''
//         Remove many activities

//         :param activity_ids: a list of activities or activity ids
//         '''
//         del_count = this.timeline_storage.remove_many(
//             this.key, activity_ids, batch_interface=None, *args, **kwargs)
//         // trim the feed sometimes
//         if trim and random.random() <= this.trim_chance:
//             this.trim()
//         this.on_update_feed(new=[], deleted=activity_ids)
//         return del_count

//     def on_update_feed(self, new, deleted):
//         '''
//         A hook called when activities area created or removed from the feed
//         '''
//         pass

//     def trim(self, length=None):
//         '''
//         Trims the feed to the length specified

//         :param length: the length to which to trim the feed, defaults to this.max_length
//         '''
//         length = length or this.max_length
//         this.timeline_storage.trim(this.key, length)

//     def count(self):
//         '''
//         Count the number of items in the feed
//         '''
//         return this.timeline_storage.count(this.key)

//     __len__ = count

//     def delete(self):
//         '''
//         Delete the entire feed
//         '''
//         return this.timeline_storage.delete(this.key)

//     static flush = (cls) => {}
//         activity_storage = cls.get_activity_storage()
//         timeline_storage = cls.getTimelineStorage()
//         activity_storage.flush()
//         timeline_storage.flush()

//     def __iter__(self):
//         raise TypeError('Iteration over non sliced feeds is not supported')

//     def __getitem__(self, k):
//         """
//         Retrieves an item or slice from the set of results.

//         """
//         if not isinstance(k, (slice, six.integer_types)):
//             raise TypeError
//         assert ((not isinstance(k, slice) and (k >= 0))
//                 or (isinstance(k, slice) and (k.start is None or k.start >= 0)
//                     and (k.stop is None or k.stop >= 0))), \
//             "Negative indexing is not supported."

//         if isinstance(k, slice):
//             start = k.start

//             if k.stop is not None:
//                 bound = int(k.stop)
//             else:
//                 bound = None
//         else:
//             start = k
//             bound = k + 1

//         start = start or 0

//         if None not in (start, bound) and start == bound:
//             return []

//         // We need check to see if we need to populate more of the cache.
//         try:
//             results = this.get_activity_slice(
//                 start, bound)
//         except StopIteration:
//             // There's nothing left, even though the bound is higher.
//             results = None

//         return results

//     def index_of(self, activity_id):
//         '''
//         Returns the index of the activity id

//         :param activity_id: the activity id
//         '''
//         return this.timeline_storage.index_of(this.key, activity_id)

//     def hydrate_activities(self, activities):
//         '''
//         hydrates the activities using the activity_storage
//         '''
//         activity_ids = []
//         for activity in activities:
//             activity_ids += activity._activity_ids
//         activity_list = this.activity_storage.get_many(activity_ids)
//         activity_data = {a.serialization_id: a for a in activity_list}
//         return [activity.get_hydrated(activity_data) for activity in activities]

//     def needs_hydration(self, activities):
//         '''
//         checks if the activities are dehydrated
//         '''
//         for activity in activities:
//             if hasattr(activity, 'dehydrated') and activity.dehydrated:
//                 return True
//         return False

//     def get_activity_slice(self, start=None, stop=None, rehydrate=True):
//         '''
//         Gets activity_ids from timeline_storage and then loads the
//         actual data querying the activity_storage
//         '''
//         activities = this.timeline_storage.get_slice(
//             this.key, start, stop, filter_kwargs=this._filter_kwargs,
//             ordering_args=this._ordering_args)
//         if this.needs_hydration(activities) and rehydrate:
//             activities = this.hydrate_activities(activities)
//         return activities

//     def _clone(self):
//         '''
//         Copy the feed instance
//         '''
//         feed_copy = copy.copy(self)
//         filter_kwargs = copy.copy(this._filter_kwargs)
//         feed_copy._filter_kwargs = filter_kwargs
//         return feed_copy

//     def filter(self, **kwargs):
//         '''
//         Filter based on the kwargs given, uses django orm like syntax

//         **Example** ::
//             // filter between 100 and 200
//             feed = feed.filter(activity_id__gte=100)
//             feed = feed.filter(activity_id__lte=200)
//             // the same statement but in one step
//             feed = feed.filter(activity_id__gte=100, activity_id__lte=200)

//         '''
//         new = this._clone()
//         new._filter_kwargs.update(kwargs)
//         return new

//     def order_by(self, *ordering_args):
//         '''
//         Change default ordering

//         '''
//         new = this._clone()
//         new._ordering_args = ordering_args
//         return new


// class UserBaseFeed(BaseFeed):

//     '''
//     Implementation of the base feed with a different
//     Key format and a really large max_length
//     '''
//     keyFormat = 'user_feed:%(userId)s'
//     max_length = 10 ** 6