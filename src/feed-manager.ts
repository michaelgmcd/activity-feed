// from stream_framework.feeds.base import UserBaseFeed
// import logging
// from stream_framework.feeds.redis import RedisFeed

// logger = logging.getLogger(__name__)
import chunk from 'lodash.chunk';

import {
  fanout_operation,
  fanoutOperationHighPriority,
  fanoutOperationLowPriority,
  follow_many,
  unfollow_many
} from './tasks';
import { UserBaseFeed } from './feeds/user';
import { RedisFeed } from './feeds/redis';
import { Activity } from './activity';

type FanoutPriority = 'HIGH' | 'LOW';

const add_operation = (
  feed,
  activities,
  trim = true,
  batch_interface = null
) => {
  feed.add_many(activities, batch_interface, trim);
};

const remove_operation = (
  feed,
  activities,
  trim = true,
  batch_interface = null
) => {
  feed.remove_many(activities, trim, batch_interface);
};

// The Manager class handles the fanout from a user's activity
// to all their follower's feeds

// .. note::
//     Fanout is the process which pushes a little bit of data to all of your
//     followers in many small and asynchronous tasks.

// To write your own Manager class you will need to implement

// - getUserFollowerIds
// - feedClasses
// - userFeedClass

// **Example** ::

//     from stream_framework.feed_managers.base import Manager

//     class PinManager(Manager):
//         // customize the feed classes we write to
//         feedClasses = dict(
//             normal=PinFeed,
//             aggregated=AggregatedPinFeed
//         )
//         // customize the user feed class
//         userFeedClass = UserPinFeed

//         // define how stream_framework can get the follower ids
//         getUserFollowerIds = (userId) => {
//             ids = Follow.objects.filter(target=userId).values_list('userId', flat = true)
//             return {fanoutPriority.HIGH:ids}
//         // utility functions to easy integration for your project
//         add_pin = (pin) => {
//             activity = pin.create_activity()
//             // add user activity adds it to the user feed, and starts the fanout
//             this.addUserActivity(pin.userId: number, activity: Activity)
//         remove_pin = (pin) => {
//             activity = pin.create_activity()
//             // removes the pin from the user's followers feeds
//             this.removeUserActivity(pin.userId, activity)
export class Manager {
  // : a dictionary with the feeds to fanout to
  // : for example feedClasses = dict(normal=PinFeed, aggregated=AggregatedPinFeed)
  feedClasses = {
    normal: RedisFeed
  };
  // : the user feed class (it stores the latest activity by one user)
  UserFeedClass = UserBaseFeed;

  // : the number of activities which enter your feed when you follow someone
  followActivityLimit = 5000;
  // : the number of users which are handled in one asynchronous task
  // : when doing the fanout
  fanoutChunkSize = 100;

  // maps between priority and fanout tasks
  priorityFanoutTask = {
    HIGH: fanoutOperationHighPriority,
    LOW: fanoutOperationLowPriority
  };

  // Returns a dict of users ids which follow the given user grouped by
  // priority/importance

  // eg.
  // {'HIGH': [...], 'LOW': [...]}

  // :param userId: the user id for which to get the follower ids
  getUserFollowerIds = (userId: number): { HIGH: string[]; LOW: string[] } => ({
    HIGH: [],
    LOW: []
  });

  // Store the new activity and then fanout to user followers

  // This function will
  // - store the activity in the activity storage
  // - store it in the user feed (list of activities for one user)
  // - fanout for all feedClasses

  // :param userId: the id of the user
  // :param activity: the activity which to add
  addUserActivity = (userId: number, activity: Activity) => {
    // add into the global activity cache (if we are using it)
    this.UserFeedClass.insertActivity(activity);
    // now add to the user's personal feed
    const userFeed = this.getUserFeed(userId);
    userFeed.add(activity);
    const operationKWArgs = { activities: [activity], trim: true };

    const followerMapping = this.getUserFollowerIds(userId);
    Object.keys(followerMapping).forEach(priority => {
      const followerIds = followerMapping[priority];
      Object.values(this.feedClasses).forEach(feedClass => {
        this.createFanoutTasks(
          followerIds,
          feedClass,
          add_operation,
          operationKWArgs,
          priority
        );
      });
    });
  };

  // Remove the activity and then fanout to user followers

  // :param userId: the id of the user
  // :param activity: the activity which to remove
  removeUserActivity = (userId: number, activity: Activity) => {
    // we don't remove from the global feed due to race conditions
    // but we do remove from the personal feed
    const userFeed = this.getUserFeed(userId);
    userFeed.remove(activity);

    // no need to trim when removing items
    const operationKWArgs = { activities: [activity], trim: false };

    const followerMapping = this.getUserFollowerIds(userId);
    Object.keys(followerMapping).forEach(priority => {
      const followerIds = followerMapping[priority];
      Object.values(this.feedClasses).forEach(feedClass => {
        this.createFanoutTasks(
          followerIds,
          feedClass,
          operation,
          operationKWArgs,
          priority
        );
      });
    });
  };

  // get the feed that contains the sum of all activity
  // from feeds :userId is subscribed to

  // :returns dict: a dictionary with the feeds we're pushing to
  getFeeds = (userId: number) => {
    const feeds = {};
    Object.keys(this.feedClasses).forEach(key => {
      const feed = this.feedClasses[key];
      feeds[userId] = feed;
    });
  };

  // feed where activity from :userId is saved
  // :param userId: the id of the user
  getUserFeed = (userId: number) => new this.UserFeedClass(userId);

  // Update the user activities
  // :param activities: the activities to update
  update_user_activities = (activities: Activity[]) => {
    activities.forEach(activity => {
      this.addUserActivity(activity.actor.id, activity);
    });
  };
  // update_user_activity = (activity) => {
  //     this.update_user_activities([activity])

  // }
  // follow_feed = (feed, source_feed) => {
  //     '''
  //     copies source_feed entries into feed
  //     it will only copy followActivityLimit activities

  //     :param feed: the feed to copy to
  //     :param source_feed: the feed with a list of activities to add
  //     '''
  //     activities = source_feed[:this.followActivityLimit]
  //     if activities:
  //         return feed.add_many(activities)

  // }
  //     unfollow_feed = (feed, source_feed) => {
  //         '''
  //         removes entries originating from the source feed form the feed class
  //         this will remove all activities, so this could take a while
  //         :param feed: the feed to copy to
  //         :param source_feed: the feed with a list of activities to remove
  //         '''
  //         activities = source_feed[:]  // need to slice
  //         if activities:
  //             return feed.remove_many(activities)

  //     }
  //     follow_user = (userId, target_user_id, async_ = true) => {
  //         '''
  //         userId starts following target_user_id

  //         :param userId: the user which is doing the following
  //         :param target_user_id: the user which is being followed
  //         :param async_: controls if the operation should be done via celery
  //         '''
  //         this.follow_many_users(userId, [target_user_id], async_)

  //     }
  //     unfollow_user = (userId, target_user_id, async_ = true) => {
  //         '''
  //         userId stops following target_user_id

  //         :param userId: the user which is doing the unfollowing
  //         :param target_user_id: the user which is being unfollowed
  //         :param async_: controls if the operation should be done via celery
  //         '''
  //         this.unfollow_many_users(userId, [target_user_id], async_)

  //     }
  //     follow_many_users = (userId, target_ids, async_ = true) => {
  //         '''
  //         Copies feeds' entries that belong to target_ids into the
  //         corresponding feeds of userId.

  //         :param userId: the user which is doing the following
  //         :param target_ids: the users to follow
  //         :param async_: controls if the operation should be done via celery
  //         '''
  //         if async_:
  //             follow_many_fn = follow_many.delay
  //         else:
  //             follow_many_fn = follow_many

  //         follow_many_fn(
  //             self,
  //             userId,
  //             target_ids,
  //             this.followActivityLimit
  //         )

  //     }
  //     unfollow_many_users = (userId, target_ids, async_ = true) => {
  //         '''
  //         Removes feeds' entries that belong to target_ids from the
  //         corresponding feeds of userId.

  //         :param userId: the user which is doing the unfollowing
  //         :param target_ids: the users to unfollow
  //         :param async_: controls if the operation should be done via celery
  //         '''
  //         if async_:
  //             unfollow_many_fn = unfollow_many.delay
  //         else:
  //             unfollow_many_fn = unfollow_many

  //         unfollow_many_fn(userId, target_ids)

  //     }

  // Returns the fanout task taking priority in account.

  // :param priority: the priority of the task
  // :param feedClass: the feedClass the task will write to
  getFanoutTask = (priority = null, feedClass = null) =>
    this.priorityFanoutTask[priority] || fanout_operation;

  // Creates the fanout task for the given activities and feed classes
  // followers
  // It takes the following ids and distributes them per fanoutChunkSize
  // into smaller tasks
  // :param followerIds: specify the list of followers
  // :param feedClass: the feed classes to run the operation {on} from './tasks';
  // :param operation: the operation function applied to all follower feeds
  // :param operationKWArgs: kwargs passed to the operation
  // :param fanout_priority: the priority set to this fanout
  createFanoutTasks = (
    followerIds,
    feedClass,
    operation,
    operationKWArgs = null,
    fanout_priority = null
  ) => {
    const fanoutTask = this.getFanoutTask(fanout_priority, feedClass);
    if (!fanoutTask) {
      return [];
    }
    const userIdsChunks = chunk(followerIds, this.fanoutChunkSize);

    return userIdsChunks.map(chunk =>
      fanoutTask.delay(this, feedClass, chunk, operation, operationKWArgs)
    );
  };

  // This functionality is called from within stream_framework.tasks.fanout_operation
  // :param userIds: the list of user ids which feeds we should apply the
  //     operation against
  // :param feedClass: the feed to run the operation on
  // :param operation: the operation to run on the feed
  // :param operationKWArgs: kwargs to pass to the operation
      fanout = (userIds: number[], feedClass, operation, operationKWArgs) => {
          with this.metrics.fanout_timer(feedClass):
              const separator = '==='.repeat(10)

              const batch_context_manager = feedClass.get_timeline_batch_interface()
              with batch_context_manager as batch_interface:
                  logger.info(msg_format, feedClass, len(userIds))
                  operationKWArgs['batch_interface'] = batch_interface
                  for userId in userIds:
                      logger.debug('now handling fanout to user %s', userId)
                      feed = feedClass(userId)
                      operation(feed, **operationKWArgs)

          const fanoutCount = operationKWArgs['activities'].length * userIds.length
      }

  //     batch_import = (userId, activities, fanout = true, chunk_size=500) => {
  //         '''
  //         Batch import all of the users activities and distributes
  //         them to the users followers

  //         **Example**::

  //             activities = [long list of activities]
  //             stream_framework.batch_import(13, activities, 500)

  //         :param userId: the user who created the activities
  //         :param activities: a list of activities from this user
  //         :param fanout: if we should run the fanout or not
  //         :param chunk_size: per how many activities to run the batch operations

  //         '''
  //         activities = list(activities)
  //         // skip empty lists
  //         if not activities:
  //             return
  //         logger.info('running batch import for user %s', userId)

  //         userFeed = this.getUserFeed(userId)
  //         if activities[0].actor_id != userId:
  //             raise ValueError('Send activities for only one user please')

  //         activity_chunks = list(chunks(activities, chunk_size))
  //         logger.info('processing %s items in %s chunks of %s',
  //                     len(activities), len(activity_chunks), chunk_size)

  //         for index, activity_chunk in enumerate(activity_chunks):
  //             // first insert into the global activity storage
  //             this.userFeedClass.insert_activities(activity_chunk)
  //             logger.info(
  //                 'inserted chunk %s (length %s) into the global activity store', index, len(activity_chunk))
  //             // next add the activities to the users personal timeline
  //             userFeed.add_many(activity_chunk, trim=False)
  //             logger.info(
  //                 'inserted chunk %s (length %s) into the user feed', index, len(activity_chunk))
  //             // now start a big fanout task
  //             if fanout:
  //                 logger.info('starting task fanout for chunk %s', index)
  //                 follower_ids_by_prio = this.getUserFollowerIds(
  //                     userId=userId)
  //                 // create the fanout tasks
  //                 operationKWArgs = dict(activities=activity_chunk, trim=False)
  //                 for feedClass in this.feedClasses.values():
  //                     for priority_group, fids in follower_ids_by_prio.items():
  //                         this.createFanoutTasks(
  //                             followerIds,
  //                             feedClass,
  //                             operation,
  //                             fanout_priority=priority_group,
  //                             operationKWArgs=operationKWArgs
  //                         )
}
